<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let href: string = "";
    export let title: string | undefined = undefined;
    export let download = false;
    export let target: "_blank" | undefined = undefined;

    const dispatch = createEventDispatcher();
</script>

{#if href == ""}
    <button {title} on:click={(e) => dispatch("click", e)}>
        <slot></slot>
    </button>
{:else}
    <a
        {href}
        {title}
        {target}
        download={download ? href.split("/").at(-1) : undefined}
        on:click={(e) => dispatch("click", e)}
    >
        <slot></slot>
    </a>
{/if}

<style lang="scss">
    a,
    button {
        display: inline-block;

        text-decoration: none;
        padding: 0.5rem 1rem;

        background-color: var(--strata);
        color: white;

        border: none;
        font-size: 1em;
        outline: none;
        cursor: pointer;

        font-family: inherit;

        border-radius: 0.25rem;

        transition: 250ms;

        &:hover,
        &:focus {
            background-color: var(--strataBright);
        }
    }
</style>
