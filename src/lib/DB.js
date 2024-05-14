export default class DB {

    constructor(spotifyApi, playlistIndexStore) {
        console.log('PlaylistIndexDB.constructor entry');
        this.sp = spotifyApi;
        this.playlistIndexStore = playlistIndexStore;
        this.playlistIndexStore.subscribe((newStoreValue) => {
            try {
                window.localStorage.setItem('playlistIndex', JSON.stringify([...newStoreValue]));
            }
            catch(e) {
                console.error('DB.update failed to write playlistIndex to localStorage', e);
            }
        });
    }

    initializePlaylistsChunk(json) {
        if (json.items) {
            for (let playlist of json.items) {
                const id = playlist.id;
                if (id) {
                    const snapshotId = playlist.snapshot_id || '';
                    const name = playlist.name || 'Unknown name';
                    const total = (playlist.tracks && playlist.tracks.total) ? playlist.tracks.total : 0;
                    const fullyLoaded = false;
                    const tracks = [];

                    this.playlistIndexStore.update((old) => {
                        return new Map([...old, [id, {snapshotId, name, total, fullyLoaded, tracks}]]);
                    });
                }
            }
        }
    }

    async updatePlaylists() {
        // Don't do anything to the playlist index Store if there are any fetch errors during the update process,
        // else we run the risk of removing playlists from the Store
        try {
            const newMap = new Map();

            let items = [];

            let json = await this.sp.fetchPlaylists();
            if (json.items) {
                items = items.concat(json.items);
            }

            while (!json.error && json.next) {
                json = await this.sp.fetchPlaylists(json.next);
                if (json.items) {
                    items = items.concat(json.items);
                }
            }

            if (json.error) {
                console.error('DB.updatePlaylists fetchPlaylists error:', json.error);
            }

            // Get the old playlist index from localStorage
            const playlistIndexStorage = window.localStorage.getItem('playlistIndex') || '[]';
            let playlistIndexJson;
            try {
                playlistIndexJson = JSON.parse(playlistIndexStorage);
            }
            catch(e) {
                console.error('Store.js playlist index storage JSON invalid syntax', e);
                playlistIndexJson = [];
            }
            const oldMap = new Map(playlistIndexJson);

            // Iterate through the new list of playlists
            for (let playlist of items) {
                const id = playlist.id;
                if (id) {
                    const snapshotId = playlist.snapshot_id || '';
                    const name = playlist.name || 'Unknown name';
                    const total = (playlist.tracks && playlist.tracks.total) ? playlist.tracks.total : 0;
                    let fullyLoaded = false;
                    let tracks = [];
                    // If this playlist was also in the old index, with the same snapshot_id,
                    // then copy the old playlist's tracks into the new playlist entry
                    if (oldMap.has(id)) {
                        const oldPlaylistObject = oldMap.get(id);
                        if (oldPlaylistObject.snapshotId === snapshotId) {
                            tracks = [...oldPlaylistObject.tracks];
                            fullyLoaded = oldPlaylistObject.fullyLoaded;
                        }
                    }
                    newMap.set(id, {snapshotId, name, total, fullyLoaded, tracks});
                }
            }

            // Update the new playlist index Store
            this.playlistIndexStore.update(() => newMap);
        }
        catch(e) {
            console.error('Exception in updatePlaylists:', e);
        }
    }

    async fetchAllPlaylists(playlistIndexSize) {
        console.log('fetchAllPlaylists. size:', playlistIndexSize);

        try {
            if (playlistIndexSize === 0) {
                // If the Store is empty, populate it chunk by chunk
                let json = await this.sp.fetchPlaylists();
                this.initializePlaylistsChunk(json);

                while (json.next) {
                    json = await this.sp.fetchPlaylists(json.next);
                    this.initializePlaylistsChunk(json);
                }

                if (json.error) {
                    console.error('DB.fetchAllPlaylists fetchPlaylists error:', json.error);
                }
    
            }
            else {
                // If the Store is not empty, update all playlists,
                // removing deleted playlists, removing tracks from updated playlists,
                // and adding new playlists.
                await this.updatePlaylists();
            }
        }
        catch(e) {
            console.error('Exception in fetchAllPlaylists:', e);
        }
    }

    clear() {
        this.playlistIndexStore.set(new Map());
    }

    async fetchAudioFeatures(tracksChunk) {
        // Extract just the track ids from the array of Track objects
        const trackIdList = tracksChunk.map(item => item.id);

        const json = await this.sp.fetchAudioFeatures(trackIdList);

        return [...json.audio_features];
    }

    async updateTracks(playlistId, json, tracks) {
        const tracksChunk = [];
        console.log('updateTracks json', json);
        if (json.items) {
            for (let item of json.items) {
                if (item.track && item.track.id) {
                    const id = item.track.id;
                    const isPlayable = item.track.is_playable || false;
                    const isLocal = item.track.is_local || false;
                    const previewUrl = item.track.preview_url || 'null';
                    let name = 'Track Deleted';
                    let artist = 'Unknown artist';
                    let album = 'Unknown album';
                    if (item.track.name) {
                        name = item.track.name;
                        if (item.track.artists && item.track.artists.length > 0) {
                            artist = item.track.artists[0].name;
                        }
                    }
                    if (item.track.album && item.track.album.name) {
                        album = item.track.album.name;
                    }
                    const track = {name, id, isPlayable, isLocal, artist, album, previewUrl, bpm: 0};
                    //if (isPlayable) {
                    tracksChunk.push(track);
                    //}
                }
                else {
                    console.error('updateTracks. No Track Id:', item);
                }
            }

            // Fetch audio features for all tracks in tracksChunk
            // array of features objects containing track "id" and "tempo" properties in each item
            const audioChunk = await this.fetchAudioFeatures(tracksChunk);

            // Iterate through tracksChunk and audioChunk, extracting the tempo from the
            // audio chunk for the track id in trackChunk, and updating the tracksChunk objects

            const tracksChunkLength = tracksChunk.length;
            const audioChunkLength = audioChunk.length;

            let tracksIndex = 0;  
            let found = false;
            for (let audioIndex = 0; audioIndex < audioChunkLength; audioIndex++) {
                found = false;
                for (let tracksCount = 0; tracksCount < tracksChunkLength; tracksCount++) {
                    if (audioChunk[audioIndex] && audioChunk[audioIndex].id && audioChunk[audioIndex].tempo) {
                        if (tracksChunk[tracksIndex].id == audioChunk[audioIndex].id) {
                            const tempo = audioChunk[audioIndex].tempo || 0;
                            tracksChunk[tracksIndex] = {...tracksChunk[tracksIndex], bpm: tempo};
                            found = true;
                        }
                    }
                    tracksIndex++;
                    if (tracksIndex > tracksChunkLength) {
                        tracksIndex = 0;
                    }
                    if (found) {
                        break;
                    }
                }
            }

            tracks.push(...tracksChunk);

            this.playlistIndexStore.update((oldMap) => {
                const updatedMap = new Map([...oldMap]);
                const playlistEntry = updatedMap.get(playlistId);
                playlistEntry.tracks = [...tracks];
                updatedMap.set(playlistId, playlistEntry);
                return updatedMap;
            });
        }
    }

    async fetchAllTracks(playlistId) {
        try {
            let tracks = [];

            let json = await this.sp.fetchTracks(playlistId);
            await this.updateTracks(playlistId, json, tracks);

            while (!json.error && json.next) {
                json = await this.sp.fetchTracks(playlistId, json.next);
                await this.updateTracks(playlistId, json, tracks);
            }

            if (json.error) {
                console.error('DB.fetchAllTracks fetchTracks error:', json.error);
            }
            else {
                this.playlistIndexStore.update((oldMap) => {
                    const updatedMap = new Map([...oldMap]);
                    const playlistEntry = updatedMap.get(playlistId);
                    playlistEntry.fullyLoaded = true;
                    updatedMap.set(playlistId, playlistEntry);
                    return updatedMap;
                });
            }
        }
        catch(e) {
            console.error('Exception in fetchAllTracks:', e);
        }
    }
}
