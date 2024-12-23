<script>
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import IDB from '$lib/IDB';
    import { TermsAcceptedStore, IDBStore, DBStateStore } from '$lib/stores/Store';
    import Terms from '$lib/components/Terms.svelte';
    import Privacy from '$lib/components/Privacy.svelte';
    import { SpotifyApiStore as sp } from '$lib/stores/Store';

    let refreshToken = window.localStorage.getItem('refresh_token') || 'Empty';

    async function updateButtonClick() {
        window.localStorage.setItem('refresh_token', refreshToken);
        window.localStorage.setItem('access_token', 'reset');

        await $sp.checkAccessToken();
    }
</script>

<section>
    <p><label for="inputRefreshToken">Refresh Token:</label></p>
    <p><textarea id="inputRefreshToken" name="inputRefreshToken" rows="5" cols="140" required bind:value="{refreshToken}" /></p>
    <p><button on:click={updateButtonClick}>Update</button></p>
</section>

<style>
    section {
        padding: 0 0.5rem 1rem 0.5rem;
        background-color: white;
        flex-grow: 1;
        color: black;
    }
</style>
