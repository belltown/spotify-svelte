import { readable, writable } from 'svelte/store';
import SpotifyApi from '$lib/SpotifyApi';
//import DB from '$lib/DB';
import IDB from '$lib/IDB';

const termsAccepted = window.localStorage.getItem('terms_accepted') === 'yes' ? true : false;
export const TermsAcceptedStore = writable(termsAccepted);

const accessToken = window.localStorage.getItem('access_token') || '';
const refreshToken = window.localStorage.getItem('refresh_token') || '';
const expiresMs = parseInt(window.localStorage.getItem('expires_ms') || '0', 10) || 0;
export const TokenStore = writable({ accessToken, refreshToken, expiresMs });

export const AppErrorStore = writable([]);

/*
const playlistIndexStorage = window.localStorage.getItem('playlistIndex') || '[]';
let playlistIndexJson;
try {
    playlistIndexJson = JSON.parse(playlistIndexStorage);
}
catch(e) {
    console.error('Store.js playlist index storage JSON invalid syntax', e);
    playlistIndexJson = [];
}*/
//export const PlaylistIndexStore = writable(new Map(playlistIndexJson));

export const PlaylistIndexStore = writable(new Map());

const spotifyApi = new SpotifyApi();
export const SpotifyApiStore = readable(spotifyApi);

//export const DBStore = readable(new DB(spotifyApi, PlaylistIndexStore));

export const DBStateStore = writable(IDB.DB_CLOSED);

const dbi = new IDB(DBStateStore, spotifyApi, PlaylistIndexStore);
export const IDBStore = readable(dbi);
