<script>
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import IDB from '$lib/IDB';
    import { TermsAcceptedStore, IDBStore, DBStateStore } from '$lib/stores/Store';
    import Terms from '$lib/components/Terms.svelte';
    import Privacy from '$lib/components/Privacy.svelte';

    $: window.localStorage.setItem('terms_accepted', $TermsAcceptedStore ? 'yes' : 'no');

    // Just in case we navigated back to a playlist page after logging out
    // TODO ???
    //goto(`${base}/`, { replace: true });
</script>

<section>
    {#if $DBStateStore !== IDB.DB_FAILED}
        <div id="top">
            {#if $TermsAcceptedStore}
                <h4>Log in to see your playlists.</h4>
            {/if}

            <div id="termsContainer">
                <input bind:checked={$TermsAcceptedStore}
                    type="checkbox"
                    id="termsCheckbox"
                    name="termsCheckbox">
                <label for="termsCheckbox">
                    I have read, and agree to,
                    <u>the End User License Agreement and Privacy Policy</u>.
                </label>
            </div>
        </div>

        {#if !$TermsAcceptedStore}
            <div id="middle">
                <div id="termsDetails">
                    <Terms />
                    <Privacy />
                </div>
            </div>
        {/if}

        <div id="bottom">
            <a id="gh" href="https://github.com/belltown/spotify-svelte">
                <img src={`${base}/github-mark.svg`} alt="GitHub Logo">
            </a>
        </div>
    {:else}
        <div id="dbError">
            <p>There was an error accessing the device's database.</p>
            <p>Check that you are using a browser that supports
                <a href="https://caniuse.com/indexeddb" target="_blank">IndexedDB</a>,
                and that you are not running in Private Browsing mode</p>
        </div>
    {/if}
</section>

<style>
    section {
        padding: 0 0.5rem 1rem 0.5rem;
        background-color: white;
        flex-grow: 1;
        color: black;
    }

    #dbError p {
        color: red;
    }

    #dbError a {
        color: blue;
    }

    #top, #bottom {
        padding: 0 1rem;
    }

    #middle {
        padding: 0 0 1rem 0;
    }

    #bottom {
        display: flex;
        justify-content: center;
    }

    u {
        cursor: pointer;
        color: blue;
    }

    #termsContainer {
        padding: 2rem 0;
    }

    #termsDetails {
        padding: 0;
    }

    h4 {
        margin: 0;
        padding: 2rem 0 0 0;
        color: black;
    }

    #gh {
        display: inline-block;
    }

    img {
        height: 3rem;
        width: 3rem;
    }
</style>
