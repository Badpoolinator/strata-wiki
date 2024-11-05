import fs from "fs";
import type { Root } from "mdast";
import { parseMarkdown } from "./markdown.server";

import {
    ParameterParser,
    ProjectParser,
    TypeParser,
    VariableParser,
    type NamespaceParser,
} from "typedoc-json-parser";
import { reportLint } from "$lib/linter.server";
import { urlifyString } from "$lib/util";
import { error } from "@sveltejs/kit";

// TSdoc "path" that means it's supported everywhere
const sharedName = "shared";

const cache: { [p: string]: ProjectParser } = {};
const namespaceCache: { [p: string]: { [fn: string]: NamespaceParser } } = {};

function getProject(p: string) {
    if (cache[p]) {
        return cache[p];
    }

    const dataRaw: ProjectParser.Json = JSON.parse(
        fs.readFileSync(`../docs/${p}/typedoc.json`, "utf-8")
    );
    cache[p] = new ProjectParser({ data: dataRaw, dependencies: {} });

    return cache[p];
}

function getNamespaces(p: string) {
    getProject(p);
    if (!namespaceCache[p]) {
        namespaceCache[p] = {};
    }

    function parseNamespace(namespace: NamespaceParser, prefix: string = "") {
        namespaceCache[p][prefix + namespace.name] = namespace;

        for (const ns of namespace.namespaces) {
            parseNamespace(ns, `${prefix}${namespace.name}.`);
        }
    }
    for (const namespace of cache[p].namespaces) {
        parseNamespace(namespace);
    }

    return namespaceCache[p];
}

export function parseTypedoc(p: string, name: string): Root {
    const out: string[] = [];

    out.push(
        `> [!NOTE]\n` +
            `Typedoc browsing is in early access and will probably change in the future. If you got feedback, ping max in it.`
    );

    if (name.startsWith("types/")) {
        out.push(...renderTypePage(name.slice(6), p));
    } else {
        out.push(...renderMainPage(p, name));
    }

    return parseMarkdown(out.join("\n\n"), `${p}/${name}`);
}

function cleanType(input: string, p: string) {
    const project = getProject(p);
    return input
        .replaceAll(`${project.name}.`, "")
        .replaceAll("typescript.", "");
}

function generateTable(
    vars: (
        | ParameterParser
        | (VariableParser & {
              rest?: never;
              optional?: never;
          })
    )[],
    p: string
) {
    const temp: string[] = [];

    temp.push("| Name | Type | Description |");
    temp.push("|---|---|---|");

    for (const param of vars) {
        let type = cleanType(param.type.toString().replaceAll("|", "\\|"), p);

        switch (param.type.kind) {
            case TypeParser.Kind.Intrinsic:
                break;

            /* case TypeParser.Kind.Reference:
                type = `[${type}](./types/${type})`;
                break; */

            default:
                type = `\`${type}\``;
                break;
        }

        temp.push(
            `| \`${param.rest ? "..." : ""}${param.name}\` | ${type} ${
                param.optional ? "(optional)" : ""
            } | ${param.comment.description || "*No description provided.*"} |`
        );
    }

    return temp;
}

function renderTypePage(name: string, p: string): string[] {
    //TODO Viewing types is currently not supported due to it being too complex for the initial release. Add in later release!
    console.log(
        "Tried viewing types for",
        name,
        "in",
        p,
        "which is currently not supported."
    );
    throw error(404, "Page not found");
}

function renderMainPage(p: string, name: string): string[] {
    const project = getProject(p);

    const namespaces = getNamespaces(p);

    const namespace = namespaces[name];

    if (!namespace) {
        throw error(404, "Page not found");
    }

    const out: string[] = [];

    out.push(`# ${name}`);

    if (namespace.source?.url) {
        out.push(`[View Source](${namespace.source.url})`);
    }

    if (namespace.comment.description) {
        out.push(namespace.comment.description);
    }

    if (namespace.functions.length > 0) {
        out.push("## Functions");

        for (const fn of namespace.functions) {
            const signature = fn.signatures[0];

            out.push(`### ${signature.name}`);

            if (
                signature.comment.blockTags.filter(
                    (v) => v.name == "deprecated"
                ).length > 0 ||
                signature.comment.deprecated
            ) {
                out.push(
                    `> [!CAUTION]\n` +
                        `> DEPRECATED: ` +
                        (signature.comment.blockTags.filter(
                            (v) => v.name == "deprecated"
                        )[0]?.text || "Avoid using this function.")
                );
            }

            const params: string[] = [];

            for (const param of signature.parameters) {
                params.push(
                    `${param.rest ? "..." : ""}${param.name}${
                        param.optional ? "?" : ""
                    }: ${cleanType(param.type.toString(), p)}`
                );
            }

            out.push(
                "```ts\n" +
                    `${name}.${fn.name}(${params.join(
                        ", "
                    )}): ${signature.returnType
                        .toString()
                        .replaceAll(`${project.name}.`, "")}` +
                    "\n```"
            );

            out.push(
                signature.comment.description || "*No description provided.*"
            );

            if (!signature.comment.description) {
                reportLint(
                    "note",
                    "typedoc_noDesc_" + signature.name,
                    `${signature.name} does not have a description!`,
                    `${p}/${name}#${urlifyString(signature.name)}`
                );
            }

            if (signature.comment.example.length > 0) {
                const temp: string[] = [];

                temp.push(
                    `> #### Example${
                        signature.comment.example.length == 1 ? "" : "s"
                    }`
                );

                for (const example of signature.comment.example) {
                    temp.push(...example.text.split("\n"));
                }

                out.push(temp.join("\n > "));
            }

            if (signature.parameters.length > 0) {
                const temp = generateTable(signature.parameters, p);

                temp.unshift(
                    `> #### Parameter${
                        signature.parameters.length == 1 ? "" : "s"
                    }`
                );

                out.push(temp.join("\n> "));
            }

            if (signature.comment.see.length > 0) {
                const temp: string[] = [];

                temp.push("> #### See also");

                for (const see of signature.comment.see) {
                    temp.push("- " + see.text);
                }

                out.push(temp.join("\n >"));
            }
        }
    }

    if (namespace.variables.length > 0) {
        out.push("## Variables");

        const temp = generateTable(namespace.variables, p);

        out.push(temp.join("\n"));
    }

    return out;
}

export function getTypedocTopic(p: string): MenuArticle[] {
    const out: MenuArticle[] = [];

    const namespaces = getNamespaces(p);

    for (const [id, namespace] of Object.entries(namespaces)) {
        out.push({
            id: id,
            meta: {
                title: id,
                features:
                    namespace.source?.path == sharedName ||
                    !namespace.source?.path
                        ? []
                        : [namespace.source.path.toUpperCase()],
            },
        });
    }

    return out;
}

export function getTypedocPageMeta(p: string, name: string): ArticleMeta {
    //Handling for incomplete type page
    if (name.startsWith("types/")) {
        return { title: name.slice(6) };
    }

    const namespaces = getNamespaces(p);

    const namespace = namespaces[name];

    return {
        title: namespace.name,
        features:
            namespace.source?.path == sharedName || !namespace.source?.path
                ? []
                : [namespace.source.path.toUpperCase()],
    };
}