<script>
    console.warn('Top-level page.svelte');
    import PlaylistIndexContent from '$lib/components/PlaylistIndexContent.svelte';
    //import LoggedOutContent from '$lib/components/LoggedOutContent.svelte';
    import RefreshToken from '$lib/components/RefreshToken.svelte';
    import { TokenStore } from '$lib/stores/Store';
</script>

{#if !$TokenStore.accessToken}
    <!--<LoggedOutContent />-->
    <RefreshToken />
{:else}
    <PlaylistIndexContent />
{/if}

<span></span>

<style>

</style>
