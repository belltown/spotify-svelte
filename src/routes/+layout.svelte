<script>
    console.warn('Start of layout.svelte script -- before imports');
    import '$lib/app.css';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { base } from '$app/paths';
    import { ErrorLogger } from '$lib/ErrorLogger';
    import IDB from '$lib/IDB';
    import {
            TermsAcceptedStore,
            TokenStore,
            DBStateStore,
            IDBStore,
            SpotifyApiStore as sp
            }
        from '$lib/stores/Store';
    import ErrorPane from '$lib/components/ErrorPane.svelte';
    //import { goto } from '$app/navigation';

    console.warn('Start of layout.svelte script -- after imports');

    onMount(() => {
		console.log('**** layout.svelte LAYOUT MOUNTED ***');
	});

    async function loginButtonClick() {
        //const callbackUrl = `${window.location.origin}${base}/callback`;
        const callbackUrl = `${window.location.origin}${base}/login`;
        await $sp.redirectToAuthCodeFlow(callbackUrl);
    }

    function logoutButtonClick() {
        // clearAccessToken() will also clear all local storage
        //$IDBStore.close();
        $IDBStore.delete();
        $sp.clearAccessToken();
        //$DBStore.clear();
        console.log('logoutButtonClick. Navigating to /');
        // TODO: Reinstate next line???
        //window.location.href = base + '/';

        //goto(`${base}/`, { replaceState: true });
    }

    $: console.log('termsAccepted:', $TermsAcceptedStore);
    //$: playlistId = $page.params && $page.params.playlistId ? $page.params.playlistId : '';
    $: playlistId = $page.url.hash && $page.url.hash.startsWith("#") ? $page.url.hash.substring(1) : '';
    $: loggedIn = !!$TokenStore.accessToken;

    // Once the IndexedDB has been opened, read the database to populate the Store
    // TODO: DON'T INITIALIZE DB IF NOT LOGGED IN. WAIT TILL LOGIN!!!
    $: {
        if ($DBStateStore === IDB.DB_CLOSED) {
            console.log('Top-level layout.svelte. DB_CLOSED');
            if (loggedIn) {
                $IDBStore.init();
            }
        }

        if ($DBStateStore === IDB.DB_FAILED) {
            console.error('Top-level layout.svelte. DB_FAILED:', $IDBStore.errorMessage);
            new ErrorLogger($IDBStore.errorMessage);
            $IDBStore.close();
            $sp.clearAccessToken();
        }

        if ($DBStateStore === IDB.DB_INIT) {
            console.log('Top-level layout.svelte. DB_INIT');
        }

        if ($DBStateStore === IDB.DB_OPEN) {
            console.log('Top-level layout.svelte. DB_OPEN');
            // Once the DB is open we can load it
            if (loggedIn) {
                $IDBStore.load();
            }
        }

        if ($DBStateStore === IDB.DB_LOADED) {
            console.log('Top-level layout.svelte. DB_LOADED');
            // Once the DB has been loaded into the Store, we can update playlists from the API
            $IDBStore.updatePlaylists();
        }

        if ($DBStateStore === IDB.DB_UPDATED) {
            console.log('Top-level layout.svelte. DB_UPDATED');
            $IDBStore.load();
        }

        if ($DBStateStore === IDB.DB_READY) {
            console.log('Top-level layout.svelte. DB_READY');
        }

        if ($DBStateStore === IDB.DB_DELETED) {
            console.log('Top-level layout.svelte. DB_DELETED');
        }
    }

    console.warn('End of layout.svelte script');
</script>

<header>
    <a href={playlistId ? `spotify:playlist:${playlistId}` : `spotify:`}>
        <img src="{base}/spotify.webp" alt="Spotify Logo">
    </a>
    <div id="buttons">
        <button>
            <a href={playlistId ? `spotify:playlist:${playlistId}` : `spotify:`}>
                OPEN SPOTIFY
            </a>
        </button>

        {#if $DBStateStore >= IDB.DB_OPEN && $TokenStore.accessToken}
            <button on:click={logoutButtonClick}>Log Out</button>
        {:else if $TermsAcceptedStore}
            <button on:click={loginButtonClick}>Log In</button>
        {/if}
    </div>
</header>

<ErrorPane />

<main>
    <slot />
</main>

<style>
    header {
        position: sticky;
        top: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        background-color: black;
    }

    main {
        padding: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    #buttons {
        display: flex;
        flex-wrap: wrap;
    }

    img {
        height: 2rem;
        margin: 1rem;
    }

    button {
        /* background-color: var(--spotify-green); */
        background-color: var(--light-green);
        color: black;
        border: none;
        border-radius: 0.5rem;
        padding: 0.25rem 0.7rem;
        margin: 1rem 1rem 1rem 0rem;
        cursor: pointer;
        font-size: 0.85rem;
    }

    a {
        text-decoration: none;
        color: inherit;
    }
</style>
