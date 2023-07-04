<script>
    /*
        An individual Playlist route
    */
    console.log('Inside /playlist/+page.svelte');
    import { page } from '$app/stores';
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import { TokenStore } from '$lib/stores/Store';
    import PlaylistTracksContent from '$lib/components/PlaylistTracksContent.svelte';

    $: $TokenStore.accessToken || goto(`${base}/`, { replaceState: true });
    $: playlistId = $page.url.hash && $page.url.hash.startsWith("#") ? $page.url.hash.substring(1) : $page.url.hash;
    $: {
        if (!playlistId) {
            goto(`${base}/`, { replace: true });
        }
    }
</script>

{#if $TokenStore.accessToken}
    <PlaylistTracksContent playlistId={ playlistId } />
{/if}

<span />

<style>

</style>
