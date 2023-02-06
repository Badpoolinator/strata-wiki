const pages = require("./pages");
const fs = require("fs-extra");

var navs = {};

/**
 *
 * @param {string} html The HTML input to be put inside the content
 * @param {{slug: string}} opts Options for generating
 * @returns {string} The generated HTML with the template applied
 */
module.exports.applyTemplate = (html, opts = {}) => {
    var info = pages.parseSlug(opts.slug);

    opts.sidebar = this.generateSidebar(opts.slug);
    opts.nav = navs[info.game];
    opts.content = html;
    var res = fs.readFileSync("templates/main.html", "utf-8");
    console.log("Templating", opts);

    for (const [key, value] of Object.entries(opts)) {
        res = res.replaceAll(`%${key.toUpperCase()}%`, value);
    }

    return "TEMPLATE" + res;
};

/**
 * Generates the sidebar HTML for a specific page
 * @param {string} slug Slug to the page next to the sidebar
 * @returns {string} HTML generated for the sidebar
 */
module.exports.generateSidebar = (slug) => {
    var info = pages.parseSlug(slug);
    var data = pages.menu[info.game][info.category];

    console.log("DATA", data, "INFO", info, "SLUG", slug);

    if (data == undefined) {
        return ``;
    }

    var res = ``;
    for (let index = 0; index < data.length; index++) {
        const entry = data[index];
        res += `<a href="/${entry.link}" class="${entry.type}">${entry.text}</a>`;
    }

    return res;
};
module.exports.generateNav = () => {
    var games = pages.games();

    for (let index = 0; index < games.length; index++) {
        const game = games[index];
        var res = ``;

        for (let index = 0; index < game.categories.length; index++) {
            const category = game.categories[index];
            res += `<a href="/${game.id}/${category.id}/${category.home}">${category.label}</a>`;
        }

        navs[game.id] = res;
    }
};
