import { ErrorLogger } from '$lib/ErrorLogger';
import { TokenStore } from '$lib/stores/Store';
import { PUBLIC_CLIENT_ID, PUBLIC_REFRESH_TOKEN } from '$env/static/public';

export default class SpotifyApi {

    SPOTIFY_API = 'https://api.spotify.com/v1';
    SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

    refreshingAccessToken;

    constructor() {
        this.refreshingAccessToken = false;
    }

    async timeout(min, rand = 0) {
        return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * rand + min)));
    }

    storeAccessTokens(accessToken, refreshToken, expiresMs) {

        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
        window.localStorage.setItem('expires_ms', expiresMs.toString());

        TokenStore.set({
            accessToken,
            refreshToken,
            expiresMs
        });
    }

    clearAccessToken() {
        console.log('clearAccessToken entry');

        TokenStore.set({
            accessToken: '',
            refreshToken: '',
            expiresMs: 0
        });

        window.localStorage.clear();
        window.localStorage.setItem('terms_accepted', 'yes');
    }

    async redirectToAuthCodeFlow(callbackUrl) {
        console.log('PUBLIC_REFRESH_TOKEN', PUBLIC_REFRESH_TOKEN);

        if (PUBLIC_REFRESH_TOKEN) {
            this.storeAccessTokens('x', PUBLIC_REFRESH_TOKEN, 0);
            await this.refreshExpiredAccessToken(PUBLIC_REFRESH_TOKEN);
            return;
        }

        const state = this.generateVerifier();
        const verifier = this.generateVerifier();
        const challenge = await this.generateChallenge(verifier);
        try {
            window.localStorage.setItem('state', state);
            window.localStorage.setItem('verifier', verifier);
        }
        catch(e) {
            console.error('SpotifyApi.redirectToAuthCodeFlow. Unable to write to localStorage:', e);
            throw new ErrorLogger(`Unable to write to localStorage: ${e.message}`);
        }

        const scopeList = [
            'user-read-private',
            'playlist-read-private',
            'playlist-read-collaborative',
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'playlist-modify-public',
            'playlist-modify-private',
        ];

        const params = new URLSearchParams();

        params.append('client_id', PUBLIC_CLIENT_ID);
        params.append('response_type', 'code');
        params.append('redirect_uri', callbackUrl);
        params.append('state', state);
        params.append('scope', scopeList.join(' '));
        params.append('code_challenge_method', 'S256');
        params.append('code_challenge', challenge);
    
        window.location = `${this.SPOTIFY_ACCOUNTS}/authorize?${params.toString()}`;
    }
    
    generateVerifier() {
        // Use only 64-character set (spec also allows "_" and "~")
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';

        // Initialize array of 128 unsigned 8-bit integers (to all zeros)
        const array = new Uint8Array(128);

        // In-place modification of array with values in range 0 to 255
        window.crypto.getRandomValues(array);

        // Use each (0-255) array value divided by 4 (to get in range 0-63) as index into charset
        return array.reduce((a, i) => a + charset.charAt(Math.floor(i / 4)), '');
    }
    
    async generateChallenge(verifierString) {

        const
        textEncoder = new TextEncoder(),
        verifierUtf8Uint8Array = textEncoder.encode(verifierString),
        hashArrayBuffer = await window.crypto.subtle.digest('SHA-256', verifierUtf8Uint8Array),
        hashUint8Array = new Uint8Array(hashArrayBuffer),
        hashString = String.fromCharCode(...hashUint8Array),
        hashBase64 = window.btoa(hashString),
        hashBase64Utf = hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        return hashBase64Utf;
    }

    async responseNotOK(response) {
        const json = {error: ''};
        const contentTypeString = response.headers.get('Content-Type') || '';
        if (contentTypeString.includes('application/json')) {
            try {
                const jsonError = await response.json();
                json.error = JSON.stringify(jsonError);
            }
            catch(e) {
                json.error = await response.text();
            }
        }
        else if (contentTypeString.includes('text/html')) {
            json.error = `${response.status}: ${response.statusText}`;
        }
        else {
            json.error = await response.text();
        }
        if (!json.error) {
            json.error = `${response.status}: ${response.statusText}`;
        }
        return json;
    }

    responseIsJson(response) {
        const contentTypeString = response.headers.get('Content-Type') || '';
        return contentTypeString.includes('application/json');
    }

    async apiFetch(url, options) {
        let json = null;
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    // Only get JSON if there is a Content-Type response header for JSON
                    if (this.responseIsJson(response)) {
                        json = await response.json();
                        break;
                    }
                    else {
                        json = {error: ''};
                        break;
                    }
                }
                else if (response.status == 429) {
                    // Rate limit
                    console.error('apiFetch Rate Limt Reached!', response);
                    new ErrorLogger(`Spotify Rate Limit Reached`);
                    json.error = 'Spotify Rate Limit Reached';
                    break;
                }
                else {
                    json = await this.responseNotOK(response);
                }
            }
            catch(e) {
                console.error('SpotifyApi.apiFetch fetch exception:', e);
                json = {error:`apiFetch exception: ${e.message}`};
            }
            new ErrorLogger(`apiFetch retry: ${json.error}`);
            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000 + 500)));
            }
        }
        return json;
    }

    async formPost(url, params) {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const options = {
            method: 'POST',
            headers,
            body: params
        };
        const json = await this.apiFetch(url, options);
        return json;
    }

    async getAccessToken(code, verifier, callbackUrl) {
        let json = {error: ''};

        const params = new URLSearchParams();

        params.append('grant_type', 'authorization_code');
        params.append('client_id', PUBLIC_CLIENT_ID);
        params.append('redirect_uri', callbackUrl);
        params.append('code_verifier', verifier);
        params.append('code', code);

        json = await this.formPost(`${this.SPOTIFY_ACCOUNTS}/api/token`, params);
        console.log('SpotifyApi.getAccessToken json:', json);

        if (json.error) {
            console.error('SpotifyApi.getAccessToken. fetch error:', json);
        }
        else {
            const accessToken = json.access_token || '';
            const refreshToken = json.refresh_token || '';
            //const expiresInSecs = json.expires_in || 0;    // 3600 seconds (1 hour)
            const expiresInSecs = 60;   // TODO -- testing only!

            if (!accessToken || !refreshToken || expiresInSecs === 0) {
                console.error('SpotifyApi.getAccessToken. Invalid tokens from Spotify:', json);
                json.error = `Invalid tokens received from Spotify`;
            }
            else {
                // Take 90% of the expiresIn value, to ensure we renew the access token
                // with sufficient time to spare
                const expiresInMs = Math.floor(expiresInSecs * 0.9) * 1000;

                // Calculate the actual time, based on current time,
                // when we'll set the access token to expire.
                const expiresMs = Date.now() + expiresInMs;

                this.storeAccessTokens(accessToken, refreshToken, expiresMs);
            }
        }

        return json;
    }

    async fetchRefreshedAccessToken() {
        let json = {error: ''};
        let attempts = 3;
        while (attempts-- > 0) {
            const refreshToken = window.localStorage.getItem('refresh_token');

            const params = new URLSearchParams();

            params.append('grant_type', 'refresh_token');
            params.append('client_id', PUBLIC_CLIENT_ID);
            params.append('refresh_token', refreshToken);
            
            json = await this.formPost(`${this.SPOTIFY_ACCOUNTS}/api/token`, params);

            if (!json.error) {
                break;
            }
            else if (attempts <= 0) {
                console.error('spotifyApi.fetchRefreshedAccessToken. formPost error:', json.error);
                new ErrorLogger(`Unable to refresh access token! ${json.error}`);
                break;
            }

            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 500 + 500)));
        }
        return json;
    }

    async refreshExpiredAccessToken(oldRefreshToken) {
        console.log('SpotifyApi.refreshExpiredAccessToken entry');

        // Token expired; get a new one
        const json = await this.fetchRefreshedAccessToken();

        const accessToken = json.access_token || '';
        const refreshToken = json.refresh_token || oldRefreshToken;
        //const expiresInSecs = json.expires_in || 3600;
        const expiresInSecs = 60;   // TODO -- testing only!

        // Take 90% of the expiresIn value, to ensure we renew the access token
        // with sufficient time to spare
        const expiresInMs = Math.floor(expiresInSecs * 0.9) * 1000;

        // Calculate the actual time, based on current time,
        // when we'll set the access token to expire
        const expiresMs = Date.now() + expiresInMs;

        console.log(`SpotifyApi.refreshExpiredAccessToken accessToken: ${accessToken}. refreshToken: ${refreshToken}`);

        this.storeAccessTokens(accessToken, refreshToken, expiresMs);

        return accessToken;
    }

    async checkAccessToken() {

        let accessToken = window.localStorage.getItem('access_token') || '';
        const refreshToken = window.localStorage.getItem('refresh_token') || '';
        const expiresMs = parseInt(window.localStorage.getItem('expires_ms') || '0', 10) || 0;

        if (!accessToken) {
            console.error('SpotifyApi.checkAccessToken. No access_token in localStorage');
            this.clearAccessToken();
            new ErrorLogger(`No stored access token found`);
        }

        else if (!refreshToken) {
            console.error('SpotifyApi.checkAccessToken. No refresh_token in localStorage');
            this.clearAccessToken();
            new ErrorLogger(`No stored refresh token found`);
        }

        else if (Date.now() >= expiresMs) {

            let retries = 3;
            while (this.refreshingAccessToken && retries-- > 0) {
                console.warn('Refresh access token in progress');
                await this.timeout(500, 500);
            }
    
            if (this.refreshingAccessToken) {
                console.error('SpotifyApi.checkAccessToken. Failed to wait for token refresh');
                new ErrorLogger('Attempts to refresh access token failed');
                return '';
            }
    
            this.refreshingAccessToken = true;
            console.log('SpotifyApi.checkAccessToken. Access token expired');
            accessToken = await this.refreshExpiredAccessToken(refreshToken);
            this.refreshingAccessToken = false;

            if (!accessToken) {
                new ErrorLogger(`Unable to refresh access token`);
            }
        }

        return accessToken;
    }

    async apiPost(endpoint, bodyObject) {
        let json = null;
        const accessToken = await this.checkAccessToken();
        if (accessToken) {
            const url = endpoint.startsWith('/') ? `${this.SPOTIFY_API}${endpoint}` : endpoint;
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            };
            const options = {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyObject)
            };
            json = await this.apiFetch(url, options);
        }
        else {
            console.error('SpotifyApi.apiPost. No access token');
            json = {error: 'No access token'};
        }
        return json;
    }

    async apiGet(endpoint) {
        let json = null;
        const accessToken = await this.checkAccessToken();
        if (accessToken) {
            const url = endpoint.startsWith('/') ? `${this.SPOTIFY_API}${endpoint}` : endpoint;
            const headers = {
                'Authorization': `Bearer ${accessToken}`
            };
            const options = {
                method: 'GET',
                headers
            };
            json = await this.apiFetch(url, options);
        }
        else {
            console.error('SpotifyApi.apiGet. No access token');
            json = {error: 'No access token'};
        }
        return json;       
    }

    async apiPut(endpoint, bodyObject) {
        let json = null;
        const accessToken = await this.checkAccessToken();
        if (accessToken) {
            const url = endpoint.startsWith('/') ? `${this.SPOTIFY_API}${endpoint}` : endpoint;
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            };
            const options = {
                method: 'PUT',
                headers,
                body: JSON.stringify(bodyObject)
            };
            json = await this.apiFetch(url, options);
        }
        else {
            console.error('SpotifyApi.apiPut. No access token');
            json = {error: 'No access token'};
        }
        return json;       
    }

    async getCurrentUsersProfile() {
        const json = await this.apiGet('/me');
        if (json.error) {
            console.error('SpotifyApi.getCurrentUserProfile fetch error:', json.error);
        }
        return json;
    }
    
    async fetchPlaylists(url = `/me/playlists?limit=50&offset=0`) {
        const json = await this.apiGet(url);
        if (json.error) {
            new ErrorLogger(`Error fetching playlists: ${json.error}`);
        }
        return json;
    }

    async fetchTracks(playlistId, url = '') {
        const searchParams = new URLSearchParams({
            market: 'from_token',
            limit: 100,
            offset: 0,
            fields: 'next,total,items(track(id,name,is_playable,is_local,preview_url,artists(name),album(name)))'
        });
        url = url || `/playlists/${playlistId}/tracks?${searchParams.toString()}`;
        const json = await this.apiGet(url);
        if (json.error) {
            console.error('SpotifyApi.fetchTracks fetch error:', json.error);
            new ErrorLogger(`Error fetching tracks: ${json.error}`);
        }
        return json;
    }

    async fetchAudioFeatures(trackIdList) {
        // Join with commas
        const trackIdListString = trackIdList.join(',');

        // Generate URL with query-string URL-encoded
        const searchParams = new URLSearchParams({'ids': trackIdListString});

        const url = `/audio-features?${searchParams.toString()}`;

        const json = await this.apiGet(url);
        if (json.error) {
            console.error('SpotifyApi.fetchAudioFeatures fetch error:', json.error);
            new ErrorLogger(`Error fetching audio features: ${json.error}`);
        }
        else if (!json.audio_features || !Array.isArray(json.audio_features)) {
            console.error('SpotifyApi.fetchAudioFeatures no audio_features in JSON:', json);
            json.audio_features = [];
        }

        return json;
    }

    async getPlaybackState() {
        const json = await this.apiGet('/me/player');
        if (json.error) {
            console.error('SpotifyApi.getPlaybackState fetch error:', json.error);
        }
        return json;
    }
    
    async getAvailableDevices() {
        const json = await this.apiGet('/me/player/devices');
        if (json.error) {
            console.error('SpotifyApi.getAvailableDevices fetch error:', json.error);
            json.devices = [];
        }
        return json;
    }
    
    async transferPlayback(id) {
        const bodyObject = {
            device_ids: [id],
            play: false
            //play: true
        };
        const json = await this.apiPut('/me/player', bodyObject);
        if (json.error) {
            console.error('SpotifyApi.transferPlayback fetch error:', json.error);
        }
        return json;
    }

    async startPlayback(deviceId, playlistId, trackId) {
        const bodyObject = {
            context_uri: `spotify:playlist:${playlistId}`,
            // uris: [
            //     `spotify:track:${trackId}`
            // ],
            offset: {
                uri: `spotify:track:${trackId}`
            },
            position_ms: 0
        };
        const json = await this.apiPut(`/me/player/play?device_id=${deviceId}`, bodyObject);
        if (json.error) {
            console.error('SpotifyApi.startPlayback fetch error:', json.error);
        }
        return json;
    }

    async pausePlayback(deviceId) {
        if (!deviceId) {
            console.log('SpotifyApi.pausePlayback no deviceId');
            return;
        }
        const json = await this.apiPut(`/me/player/pause?device_id=${deviceId}`);
        if (json.error) {
            console.error('SpotifyApi.pausePlayback fetch error:', json.error);
        }
        return json;
    }

    async addPlaylistTracks(playlistId, trackIdList) {
        let chunk = trackIdList.splice(0, 100);
        if (chunk.length > 0) { 
            const bodyObject = {
                uris: chunk.map((trackId) => `spotify:track:${trackId}`)
            };
            const json = await this.apiPost(`/playlists/${playlistId}/tracks`, bodyObject);
            if (!json.error) {
                return trackIdList;
            }
            else {
                console.error('SpotifyApi.addPlaylistTracks fetch error:', json.error);
            }
        }
        return [];
    }

    async createPlaylist(playlistName, sortValue) {
        let sortedByText;

        if (sortValue == 'sortNone') sortedByText = 'None'
        else if (sortValue == 'sortBpm') sortedByText = 'BPM'
        else if (sortValue == 'sortTrack') sortedByText = 'Track'
        else if (sortValue == 'sortArtist') sortedByText = 'Artist'
        else sortedByText = 'Unknown';

        const bodyObject = {
            name: `${playlistName} - Sorted by ${sortedByText}`,
            public: false,
            collaborative: false,
            description: `Sorted playlist from ${playlistName}`,
        };

        const userId = window.localStorage.getItem('user_id') || '';
        const json = await this.apiPost(`/users/${userId}/playlists`, bodyObject);
        if (json.error) {
            console.error('SpotifyApi.createPlaylist fetch error:', json.error);
        }
        console.log('SpotifyApi.createPlaylist json:', json);
        return json;
    }
}
