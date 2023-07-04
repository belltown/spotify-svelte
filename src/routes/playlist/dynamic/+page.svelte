<script>
    /*
        An individual Playlist route
    */
    console.log('Inside /playlist[id] page.svelte');
    import { page } from '$app/stores';
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import { TokenStore } from '$lib/stores/Store';
    import PlaylistTracksContent from '$lib/components/PlaylistTracksContent.svelte';

    $: $TokenStore.accessToken || goto(`${base}/`, { replaceState: true });
</script>

{#if $TokenStore.accessToken}
    <PlaylistTracksContent playlistId={ $page.params.playlistId } />
{/if}

<span />

<style>

</style>
