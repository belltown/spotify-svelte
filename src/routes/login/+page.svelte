<script>
console.warn('Start of callback script');
import { base } from '$app/paths';
import { goto } from '$app/navigation';
import { ErrorLogger } from '$lib/ErrorLogger';
import { TokenStore } from '$lib/stores/Store';
import { SpotifyApiStore as sp } from '$lib/stores/Store';

export let data;

const { code, verifier, state, savedState, callbackError } = data;

async function stateValidated() {
    console.log('stateValidated entry');
    //const callbackUrl = `${window.location.origin}${base}/callback`;
    const callbackUrl = `${window.location.origin}${base}/login`;

    let json = await $sp.getAccessToken(code, verifier, callbackUrl);

    if (json.error) {
        //console.error('/callback stateValidated. getAccessToken error: ', json);
        console.error('/login stateValidated. getAccessToken error: ', json);
        new ErrorLogger(`Unable to get access token: ${json.error}`);
    }
    else {
        // Check that user is registered in Developer Dashboard (if app still in Development Status),
        // and save the Spotify User Id (needed later to create new playlists)
        json = await $sp.getCurrentUsersProfile();

        console.log('Current User Profile:', json);

        if (!json.error) {
            window.localStorage.setItem('user_id', json.id);
            window.localStorage.setItem('user_product', json.product);
        }
        else {
            $sp.clearAccessToken();
            new ErrorLogger(`Unable to get user profile: ${json.error}`);
        }
    }

    goto(`${base}/`, { replaceState: true });
}

const isStateValid = state && savedState && state === savedState;
console.warn('End of callback script');
</script>

{#if callbackError}
    <pre class="errorText">Error: {callbackError}</pre>
{:else if !isStateValid}
    <pre class="errorText">Invalid 'state' returned from Spotify authentication server!<br><br></pre>
    <pre class="errorText">Try logging in again.</pre>
{:else}
    {#await stateValidated()}
        <span />
    {/await}
{/if}

<style>

</style>
