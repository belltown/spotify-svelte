<script>
    export let playlistId;

    import IDB from '$lib/IDB';
    import Tempo from '$lib/Tempo';
    import { IDBStore, DBStateStore, PlaylistIndexStore, SpotifyApiStore as sp } from '$lib/stores/Store';

    let currentTrackId = '';

    async function timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function playTrack(trackId) {
        currentTrackId = trackId;

        let deviceId = '';
        let state = await $sp.getPlaybackState();
        console.log('playTrack.getPlaybackState#1. state:', state);
        if (state && state.is_playing && state.device && state.device.id) {
            deviceId = state.device.id;
        }

        console.log('Before pausePlayback');
        // Won't work for "free" users
        await $sp.pausePlayback(deviceId);
        console.log('Before timeout');
        await timeout(1500);
        console.log('After timeout');
        // TODO: fetch requests while trying to start up player get Network LOAD errors
        window.location.href = `spotify:track:${trackId}`;
    }

    function sortTracks(tracks, sortValue) {
        if (sortValue === "sortBpm") {
            return [...tracks].sort((a, b) => a.bpm - b.bpm);
        }
        else if (sortValue === "sortTrack") {
            return [...tracks].sort((a, b) => a.name.localeCompare(b.name));
        }
        else if (sortValue === "sortArtist") {
            return [...tracks].sort((a, b) => a.artist.localeCompare(b.artist));
        }
        else {
            return tracks;
        }
    }

    function onSortValueChange(e) {
        if (e && e.target) {
            const newValue = e.target.value;
            console.log('onSortValueChange:', newValue);
            window.localStorage.setItem('sortValue', e.target.value);
        }
    }

    function onDanceValueChange(e) {
        if (e && e.target) {
            const newValue = e.target.value;
            console.log('onDanceValueChange:', newValue);
            window.localStorage.setItem('danceValue', e.target.value);
        }
    }

    function height(node) {
        return {
            duration: 500,
            css: (t) => `line-height: ${t}rem`
        }
    }

    async function createPlaylist() {
        if (playlistName) {
            // Start animation
            message = 'Creating new playlist ...';
            const json = await $sp.createPlaylist(playlistName, sortValue);
            if (json.id) {
                const playlistId = json.id;
                let trackIdList = tracks.map((track) => track.id);
                while (trackIdList.length > 0) {
                    // Update animation
                    trackIdList = await $sp.addPlaylistTracks(playlistId, trackIdList);
                }
                // TODO: add single playlist id to DB
                await $IDBStore.updatePlaylists();
            }
            // Stop animation
            message = 'New playlist created';
            setTimeout(() => message = '', 3000);
        }
    }

    let sortValue = window.localStorage.getItem('sortValue') || 'sortNone';
    let danceValue = window.localStorage.getItem('danceValue') || '';

    let tracksLoaded = 0;
    let message = '';

    $: console.log('PlaylistTracksContent', $DBStateStore);

    $: {
        if ($DBStateStore === IDB.DB_READY) {
            console.log('PlaylistTracksContent. DB_READY');
            $IDBStore.fetchAllTracks(playlistId);
        }
    }

    $: playlist = $PlaylistIndexStore.has(playlistId) ? $PlaylistIndexStore.get(playlistId) : null;
    $: playlistName = (playlist && playlist.name) || '';
    $: tracksNormalized = (playlist && playlist.tracks.map((item) => Tempo.normalizeBpm(item, danceValue))) || [];
    $: tracks = sortTracks(tracksNormalized, sortValue);
    $: totalTracks = (playlist && playlist.total) || 0;
    $: tracksLoaded = tracks.length;
</script>

<section>
    <h3>{playlistName} &mdash; {tracksLoaded != totalTracks ? tracksLoaded + ' / ' + totalTracks : totalTracks}
        {totalTracks == 1 ? 'Track' : 'Tracks'}</h3>

    <div id="sortMenuContainer">
        <select id="sortMenu" on:change={onSortValueChange} bind:value={sortValue}>
            <option value="sortNone">No Sort</option>
            <option value="sortBpm">BPM Sort</option>
            <option value="sortTrack">Track Sort</option>
            <option value="sortArtist">Artist Sort</option>
        </select>
        <select id="rangeMenu" on:change={onDanceValueChange} bind:value={danceValue}>
            {#each Tempo.tempoList as {key, dance} (key)}
                <option value={key}>{dance}</option>
            {/each}
        </select>   
        <button on:click={createPlaylist}>
            New Playlist
        </button>
    </div>

    {#if message}
        <div id="createPlaylistAnimation">
            {message}
        </div>
    {/if}

    <ul>
        {#each tracks as track}
            <li id={track.id}>               
                <a on:click={async () => await playTrack(track.id)}
                    style:color={track.id === currentTrackId ? 'red' : ''}
                    class:unplayable={track.isLocal || !track.isPlayable ? 'none' : ''}
                    title="Click to Play from the Album: {track.album}"
                    href={null}>
                    {#if sortValue == 'sortBpm'}
                        <p>{Math.round(track.bpm)} bpm &#9702; {track.name} &#9702; {track.artist}</p>
                    {:else if sortValue == 'sortArtist'}
                        <p>{track.artist} &#9702; {track.name} &#9702; {Math.round(track.bpm)} bpm</p>
                    {:else}
                        <p>{track.name} &#9702; {track.artist} &#9702; {Math.round(track.bpm)} bpm</p>
                    {/if}
                </a>
                <a style:color={track.previewUrl !== 'null' ? 'yellow' : 'red'} href={track.previewUrl}>
                    Preview
                </a>
            </li>
        {/each}
    </ul>
</section>

<style>
    section {
        padding: 0 0.5rem;
    }

    a {
        cursor: pointer;
    }

    a > p {
        text-indent: -1rem;
        margin: 0 0 0 1rem;
        padding-bottom: 0.25rem;
    }

    li {
        padding-bottom: 0.2rem;
        border-bottom: 1px solid black;
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

    .unplayable {
        pointer-events: none;
        color: #666;
    }

    #sortMenuContainer {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-bottom: 1rem;
    }

    button {
        /* background-color: var(--spotify-green); */
        background-color: var(--light-green);
        color: black;
        border: none;
        border-radius: 0.5rem;
        padding: 0.25rem 0.7rem;
        cursor: pointer;
        font-size: inherit;
    }

    #createPlaylistAnimation {
        color: yellow;
        margin-bottom: 1rem;
    }
</style>
