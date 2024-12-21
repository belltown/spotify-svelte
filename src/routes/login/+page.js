export async function load({ url }) {
    //console.warn('/callback/+page.js load()');
    console.warn('/login/+page.js load()');
    const { searchParams } = url;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const callbackError = searchParams.get('error');
    const savedState = window.localStorage.getItem('state') || '';
    const verifier = window.localStorage.getItem('verifier') || '';
    window.localStorage.removeItem('state');
    window.localStorage.removeItem('verifier');

    return {
        code,
        verifier,
        state,
        savedState,
        callbackError,
    };
}
