import { ErrorLogger } from '$lib/ErrorLogger';

export default class IDB {

    static DB_CLOSED = 0;
    static DB_FAILED = 1;
    static DB_INIT = 2;
    static DB_OPEN = 3;
    static DB_LOADED = 4;
    static DB_UPDATED = 5;
    static DB_READY = 6;
    static DB_DELETED = 7;

    dbStateStore;
    sp;
    playlistIndexStore;
    state;
    db;
    _errorMessage;
    playlistIndexStoreMap;

    constructor(dbStateStore, spotifyApi, playlistIndexStore) {
        this.dbStateStore = dbStateStore;
        this.sp = spotifyApi;
        this.playlistIndexStore = playlistIndexStore;
        this.state = IDB.DB_CLOSED;
        this.db = null;
        this._errorMessage = '';
        this.playlistIndexStoreMap = new Map ();

        this.playlistIndexStore.subscribe((newStoreValue) => {
            this.playlistIndexStoreMap = newStoreValue;
        });
    }

    updateState(newState) {
        // IMPORTANT!!! Don't forget to initialize DBStateStore in Store.js
        this.state = newState;
        this.dbStateStore.set(newState);
    }

    get errorMessage() {
        return this._errorMessage;
    }

    dbOnAbort(ev) {
        console.error('dbOnAbort', ev);
    }

    dbOnClose(ev) {
        console.log('dbOnClose', e);
    }

    dbOnError(ev) {
        console.error('dbOnError', ev);
    }

    dbOnVersionChange(ev) {
        console.warn('dbOnVersionChange', ev);
        new ErrorLogger('Database versionchange event');
    }

    init() {
        if (!window.indexedDB) {
            this._errorMessage = 'Browser Not Supported (no IndexedDB support)';
            this.updateState(IDB.DB_FAILED);
        }
        else {
            this.updateState(IDB.DB_INIT);

            console.warn('IDB.open. About to open database');
            const request = window.indexedDB.open('DB');

            request.onupgradeneeded = (ev) => {
                console.log('IDB request.onupgradeneeded. ev:', ev);
                const db = ev.target.result;

                try {
                    db.createObjectStore('playlistIndex', { keyPath: 'id' });
                    db.createObjectStore('playlistOrder', { autoIncrement: true });
                }
                catch(e) {
                    console.error('onupgradeneeded. createObjectStoreException:', e);
                    this._errorMessage = e.message;
                    this.updateState(IDB.DB_FAILED);
                }
            };

            // The IndexdDB has been fully created and opened
            // We can now read in the playlist index and set up to Store
            request.onsuccess = (ev) => {
                console.log('IDB request.onsuccess. ev:', ev);

                this.db = ev.target.result;

                this.db.onabort = this.dbOnAbort;
                this.db.onclose = this.dbOnClose;
                this.db.onerror = this.dbOnError;
                this.db.onversionchange = this.dbOnVersionChange;

                this.updateState(IDB.DB_OPEN);
            };

            request.onerror = (ev) => {
                console.error('IDB request.onerror. ev:', ev.target.error);
                this._errorMessage = ev.target.error.message;
                this.updateState(IDB.DB_FAILED);
            };

            request.onblocked = (ev) => {console.error('IDB request.onblocked. ev:', ev)};

            request.onversionchange = (ev) => {console.error('IDB request.onversionchange. ev:', ev)};
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            this.updateState(IDB.DB_CLOSED);
        }
    }

    delete() {
        console.log('IDB.delete. entry');

        this.db.close();

        const request = window.indexedDB.deleteDatabase('DB');
        request.onsuccess = () => {
            console.log('IDB.delete. Database deleted');
        };
        request.onerror = (ev) => {
            console.error('IDB.delete. Unable to delete database', ev.target.error);
            new ErrorLogger(`Unable to Delete Database. ${ev.target.error}`);
        };
        request.onblocked = (ev) => {
            console.error('IDB.delete. onblocked', ev);
            new ErrorLogger('Database onblocked event');
        };
        request.onupgradeneeded = (ev) => {
            console.error('IDB.delete. onupgradeneeded', ev);
        };
        this.updateState(IDB.DB_DELETED);
    }

    addPlaylist(playlist) {
        this.db.transaction('playlistIndex', 'readwrite')
        .objectStore('playlistIndex')
        .put(playlist);
    }

    initializePlaylistsChunk(json) {
        if (json.items) {
            const newMap = new Map();
            for (let playlist of json.items) {
                const id = playlist.id;
                if (id) {
                    const snapshotId = playlist.snapshot_id || '';
                    const name = playlist.name || 'Unknown name';
                    const total = (playlist.tracks && playlist.tracks.total) ? playlist.tracks.total : 0;
                    const fullyLoaded = false;
                    const tracks = [];

                    const playlistEntry = {id, snapshotId, name, total, fullyLoaded, tracks};

                    this.playlistIndexStore.update((old) => {
                        // Also put as "id" property in the Map value because
                        // the IndexedDB playlist index entries will have an "id" property
                        return new Map([...old, [id, playlistEntry]]);
                    });

                    // Add the playlist index entry to the IndexedDB
                    this.addPlaylist(playlistEntry);
                }
            }
        }
    }

    load() {
        console.log('IDB.load entry');

        const newMap = new Map();

        let transaction;
        let orderStore;
        let indexStore;
        try {
            transaction = this.db.transaction(['playlistOrder', 'playlistIndex'], 'readonly');
            orderStore = transaction.objectStore('playlistOrder');
            indexStore = transaction.objectStore('playlistIndex');
        }
        catch(e) {
            console.error('IDB.load. Database transaction exception', e);
            this.updateState(IDB.DB_FAILED);
        }

        // Read the (only) item in the playlistOrder object store into a Set,
        // then iterate through the Set
        const orderRequest = orderStore.get(1);
        orderRequest.onsuccess = (ev) => {
            const set = ev.target.result;
            if (set) {
                for (let playlistId of set) {
                    indexStore.get(playlistId).onsuccess = (ev) => {
                        newMap.set(playlistId, ev.target.result);
                    };
                }
            }
            else {
                console.log('IDB.load No playlistOrder object store data read');
            }
        };

        orderRequest.onerror = (ev) => {
            console.error('IDB.load Unable to read playlistOrder store');
        };

        transaction.oncomplete = (ev) => {
            console.log('load. transaction.oncomplete. this:', this);
            this.playlistIndexStore.set(newMap);
            if (this.state === IDB.DB_OPEN) {
                console.log('IDB.load was DB_OPEN');
                this.updateState(IDB.DB_LOADED);
            }
            else {
                console.log('IDB.load NOT DB_OPEN')
                this.updateState(IDB.DB_READY);
            }
            console.log('>>> IDB.load transaction complete <<<', ev);
        };
    }

    addPlaylistItemsToMap(items, map, playlistIdList) {
        for (let playlist of items) {
            const id = playlist.id;
            if (id) {
                const snapshotId = playlist.snapshot_id || '';
                const name = playlist.name || 'Unknown name';
                const total = (playlist.tracks && playlist.tracks.total) ? playlist.tracks.total : 0;
                const fullyLoaded = false;
                const tracks = [];
                map.set(id, {snapshotId, name, total, fullyLoaded, tracks});
                playlistIdList.push(id);
            }
        }
    }

    async fetchPlaylists(newIndexMap, newOrderList) {
        console.log('IDB.fetchPlaylists entry');

        let json = await this.sp.fetchPlaylists();
        if (json.items) {
            this.addPlaylistItemsToMap(json.items, newIndexMap, newOrderList);
        }

        while (!json.error && json.next) {
            json = await this.sp.fetchPlaylists(json.next);
            if (json.items) {
                this.addPlaylistItemsToMap(json.items, newIndexMap, newOrderList);
            }
        }

        if (json.error) {
            console.error('DB.updatePlaylists fetchPlaylists error:', json.error);
        }

        console.log('IDB.fetchPlaylists return');
    }

    async updatePlaylists() {
        // Don't do anything to the playlist index Store if there are any fetch errors during the update process,
        // else we run the risk of removing playlists from the Store
        try {
            // If there are already playlists in the IndexedDB, then display them
            // Read the orderStore to determine the (unsorted) display order,
            // then read the indexStore to update the playlistIndexStore,
            // which will result in the playlist being displayed.
            //this.updatePlaylistIndexStore();

            // Read the current list of all user's playlists from the Spotify API

            const newIndexMap = new Map();
            const newOrderList = [];
    
            await this.fetchPlaylists(newIndexMap, newOrderList);

            console.log('>>> Starting to populate playlistOrder object store <<<');

            const transaction = this.db.transaction(['playlistOrder', 'playlistIndex'], 'readwrite');

            const orderObjectStore = transaction.objectStore('playlistOrder');

            orderObjectStore.put(newOrderList, 1);

            // Now we have a Map from the current Spotify API playlists, read existing IndexedDB playlists
    
            //const indexTransaction = this.db.transaction('playlistIndex', 'readwrite');
            const indexObjectStore = transaction.objectStore('playlistIndex');

            indexObjectStore.openCursor().onsuccess = (ev) => {
                const cursor = ev.target.result;
                if (cursor) {
                    // We have a playlist. The id is the cursor key
                    const id = cursor.key;
                    const dbPlaylist = cursor.value;

                    // Check if playlist still exists in the Spotify API
                    if (newIndexMap.has(id)) {
                        // Playlist is still in the Spotify API
                        // Check whether it still has the same snapshot id
                        const spotifyPlaylist = newIndexMap.get(id);
                        if (spotifyPlaylist.snapshotId !== dbPlaylist.snapshotId) {
                            console.warn('Playlist snapshotId has changed');
                            // If the snapshot ID has changed, replace the existing
                            // IndexedDB playlist with the Spotify API playlist,
                            // with an empty tracks array.
                            indexObjectStore.put({id, ...spotifyPlaylist});
                        }
                        // Remove the playlist from the list of Spotify API playlists
                        newIndexMap.delete(id);
                    }
                    else {
                        console.warn('Playlist no longer exists in the Spotify API');
                        // Delete this playlist from IndexedDB
                        indexObjectStore.delete(id);
                    }
                    cursor.continue();
                }
                else {
                    console.log('Cursor is empty');
                    // Now we can remove iterate through the Spotify API playlist list,
                    // adding to the IndexedDB
                    for (let [id, spotifyPlaylist] of newIndexMap) {
                        indexObjectStore.put({id, ...spotifyPlaylist});
                    }
                }
            };

            transaction.oncomplete = () => {
                console.log('>>> Finished populating playlistOrder and playlistIndex object stores <<<');
                this.load();
                this.updateState(IDB.DB_UPDATED);
            };
        }
        catch(e) {
            console.error('Exception in updatePlaylists:', e);
        }
    }

    async fetchAllPlaylists() {
        console.log('fetchAllPlaylists entry');
        await this.updatePlaylists();
        console.log('fetchAllPlaylists exit');
    }


    async fetchAudioFeatures(tracksChunk) {
        const audioMap = new Map();

        if (tracksChunk.length > 0) {
            // Extract just the track ids from the array of Track objects
            const trackIdList = tracksChunk.map(item => item.id);

            const json = await this.sp.fetchAudioFeatures(trackIdList);

            if (!json.error) {
                for (let trackAudiofeatures of json.audio_features) {
                    if (trackAudiofeatures) {
                        const {id, tempo, time_signature} = trackAudiofeatures;
                        if (id && tempo) {
                            audioMap.set(id, {bpm: tempo, timeSignature: time_signature || 0});
                        }
                    }
                    else {
                        console.warn('IDB.fetchAudioFeatures. Missing track audio_features');
                    }
                }
            }
        }

        return audioMap;
    }

    async getTrackChunkDetails(playlistEntry, json, allTracks) {
        console.log('IDB.getTrackChunkDetails json', json);
        const tracksChunk = [];
        if (json.items && Array.isArray(json.items)) {
            for (let item of json.items) {
                if (item.track && item.track.id) {
                    const id = item.track.id;
                    const isPlayable = item.track.is_playable || false;
                    const isLocal = item.track.is_local || false;
                    let name = 'Track Deleted';
                    let artist = 'Unknown artist';
                    let album = 'Unknown album';
                    if (item.track.name) {
                        name = item.track.name;
                    }
                    if (item.track.artists && Array.isArray(item.track.artists)) {
                        if (item.track.artists.length > 0 && item.track.artists[0].name) {
                            artist = item.track.artists[0].name;
                        }
                    }
                    if (item.track.album && item.track.album.name) {
                        album = item.track.album.name;
                    }
                    const track = {name, id, isPlayable, isLocal, artist, album, bpm: 0};
                    tracksChunk.push(track);
                }
                else {
                    console.warn('IDB.getTrackChunkDetails. No Track Id:', item);
                }
            }

            // Fetch audio features for all tracks in tracksChunk
            // array of features objects containing track "id" and "tempo" properties in each item
            const audioChunkMap = await this.fetchAudioFeatures(tracksChunk);

            // Iterate through tracksChunk and audioChunk, extracting the tempo from the
            // audio chunk for the track id in trackChunk, and updating the tracksChunk objects
            const tracksChunkLength = tracksChunk.length;
            for (let tracksIndex = 0; tracksIndex < tracksChunkLength; tracksIndex++) {
                const track = tracksChunk[tracksIndex];
                const audioEntry = audioChunkMap.get(track.id);
                if (audioEntry) {
                    tracksChunk[tracksIndex] = {
                        ...track, bpm: audioEntry.bpm, timeSignature: audioEntry.timeSignature
                    };
                }
            }
        }
        allTracks.push(...tracksChunk);
        playlistEntry.tracks = [...allTracks];
        return playlistEntry;
    }

    async updateTracksChunk(playlistId, playlistEntry, json, allTracks) {
        playlistEntry = await this.getTrackChunkDetails(playlistEntry, json, allTracks);

        // Update the PlaylistIndexStore with the tracks that have just been read
        this.playlistIndexStore.update((oldMap) => {
            const updatedMap = new Map([...oldMap]);
            updatedMap.set(playlistId, playlistEntry);
            return updatedMap;
        });
        return playlistEntry;
    }

    async fetchAllTracks(playlistId) {
        console.log('IDB.fetchAllTracks. entry');

        // This method should ONLY be called if the playlist's tracks are NOT yet fully-loaded!
        try {
            let playlistEntry = this.playlistIndexStoreMap.get(playlistId);
    
            if (!playlistEntry.fullyLoaded) {
                console.log('IDB.fetchAlltracks. tracks are NOT fully loaded');

                const allTracks = [];

                let json = await this.sp.fetchTracks(playlistId);
                playlistEntry = await this.updateTracksChunk(playlistId, playlistEntry, json, allTracks);

                while (!json.error && json.next) {
                    json = await this.sp.fetchTracks(playlistId, json.next);
                    playlistEntry = await this.updateTracksChunk(playlistId, playlistEntry, json, allTracks);
                }

                // Don't update the fullyLoaded flag if there was an error updating the playlist's tracks
                if (json.error) {
                    console.error('IDB.fetchAllTracks. fetchTracks error:', json.error);
                }
                else {
                    // Update the IndexedDB with the new playlist containing all tracks that have now been fetched
                    playlistEntry.fullyLoaded = true;
                    this.playlistIndexStore.update((oldMap) => {
                        const updatedMap = new Map([...oldMap]);
                        updatedMap.set(playlistId, playlistEntry);
                        return updatedMap;
                    });
                    const transaction = this.db.transaction('playlistIndex', 'readwrite');
                    const objectStore = transaction.objectStore('playlistIndex');
                    const request = objectStore.put({...playlistEntry});
                    request.onsuccess = (() => {
                        console.log('IDB.fetchAllTracks. updated playlist written to object store');
                    });
                    request.onerror = (ev) => {
                        console.error('IDB.fetchAllTracks. objectStore.put exception', ev);
                    }
                }
            }
            else {
                console.log('IDB.fetchAllTracks. playlist is fully loaded');
            }
        }
        catch(e) {
            console.error('IDB.fetchAllTracks. exception:', e);
        }
    }   
}
