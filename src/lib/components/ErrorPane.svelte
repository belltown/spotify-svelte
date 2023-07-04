<script>
    import { AppErrorStore } from '$lib/stores/Store';

    function deleteError(index) {
        AppErrorStore.update((old) => (old.splice(index, 1), old));
    }
</script>

{#each $AppErrorStore as err, index}
    <div class="errorContainer">
        <button class="xbutton" on:click={ () => deleteError (index) }>
            [X]
        </button>
        {@html err.message}
    </div>
{/each}

<style>
    * {
        color: red;
    }
    .errorContainer {
        border-bottom: 1px solid rgba(0, 0, 0, 0.2);
        padding: 0.1rem 0;
    }
    .xbutton {
        color: yellow;
        cursor: pointer;
        padding: 0;
        background-color: transparent;
        border: none;
        font-size: inherit;
    }
</style>
