<script>
    import { base } from '$app/paths';
    import {PlaylistIndexStore } from '$lib/stores/Store';

    let playlistSortValue = window.localStorage.getItem('playlistSortValue') || 'sortNone';

    function onPlaylistSortValueChange(e) {
        if (e && e.target) {
            const newValue = e.target.value;
            console.log('onPlaylistSortValueChange:', newValue);
            window.localStorage.setItem('playlistSortValue', e.target.value);
        }
    }

    function sortPlaylists(playlists, sortValue) {
        if (sortValue === "sortSize") {
            return [...playlists].sort((a, b) => b[1].total - a[1].total);
        }
        else if (sortValue === "sortName") {
            return [...playlists].sort((a, b) => a[1].name.localeCompare(b[1].name));
        }
        else {
            return playlists;
        }
    }

    function playlistClicked() {
        console.log('playlistClicked');
    }

    $: playlists = sortPlaylists($PlaylistIndexStore, playlistSortValue);

</script>

<section>
    <h3>{$PlaylistIndexStore.size} Playlists</h3>

    <div id="playlistSortMenuContainer">
        <select id="sortMenu" on:change={onPlaylistSortValueChange} bind:value={playlistSortValue}>
            <option value="sortNone">Unsorted</option>
            <option value="sortSize">Sort by Size</option>
            <option value="sortName">Sort by Name</option>
        </select>
    </div>

    <ul>
        {#each [...playlists] as [id, value]}
            <li {id}>
                <a on:click={playlistClicked} href="{base}/playlist/#{id}">
                    {#if playlistSortValue == 'sortSize'}
                        {value.total} {value.total == 1 ? 'track' : 'tracks'} &#9702; {value.name}
                    {:else}
                        {value.name} &#9702; {value.total} {value.total == 1 ? 'track' : 'tracks'}
                    {/if}
                </a>
            </li>
        {/each}
    </ul>
</section>

<style>
    section {
        padding: 0 0.5rem;
    }

    #playlistSortMenuContainer {
        margin-bottom: 1rem;
    }

    select {
        font-size: inherit;
        background-color: #ccc;
        border: 2px solid green;
        border-radius: 0.5rem;
        color: inherit;
        padding: 0.2rem;
    }

    option {
        background-color: #aaa;
        color: inherit;
    }

    li {
        padding-bottom: 0.2rem;
    }
</style>
