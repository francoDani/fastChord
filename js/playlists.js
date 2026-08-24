const Playlists = (function () {
  const SLOTS = [
    { key: 'entrada', label: 'Entrada', required: true },
    { key: 'perdon', label: 'Perdón', required: true },
    { key: 'gloria', label: 'Gloria', required: false },
    { key: 'aleluya', label: 'Aleluya', required: true },
    { key: 'ofertorio', label: 'Ofertorio', required: true },
    { key: 'santo', label: 'Santo', required: true },
    { key: 'cordero', label: 'Cordero', required: true },
    { key: 'comunion', label: 'Comunión', required: false, multiple: true },
    { key: 'meditacion', label: 'Meditación', required: true },
    { key: 'salida', label: 'Salida', required: true }
  ];

  function loadAll() {
    return SupabaseClient
      .from('playlists')
      .select('id, name, description, share_token, created_at, playlist_songs(song_id, slot, position, songs(id, title, artist, category, body, youtube))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(function (result) {
        if (result.error) throw result.error;
        return result.data || [];
      });
  }

  function buildSongRows(playlistId, selections) {
    const rows = [];
    let position = 0;
    SLOTS.forEach(function (slot) {
      (selections[slot.key] || []).forEach(function (songId) {
        if (songId) {
          rows.push({ playlist_id: playlistId, song_id: songId, slot: slot.key, position: position++ });
        }
      });
    });
    return rows;
  }

  function insertSongs(playlist, selections) {
    const rows = buildSongRows(playlist.id, selections);
    if (rows.length === 0) return playlist;
    return SupabaseClient.from('playlist_songs').insert(rows).then(function (songsResult) {
      if (songsResult.error) throw songsResult.error;
      return playlist;
    });
  }

  function create(name, selections) {
    const user = Auth.getUser();
    if (!user || !Auth.canEdit()) {
      return Promise.reject(new Error('Solo un editor o administrador puede crear playlists.'));
    }

    return SupabaseClient
      .from('playlists')
      .insert({ name: name, description: '', created_by: user.id, updated_by: user.id })
      .select('id, name, description, share_token')
      .single()
      .then(function (playlistResult) {
        if (playlistResult.error) throw playlistResult.error;
        return insertSongs(playlistResult.data, selections);
      });
  }

  function update(id, name, selections) {
    const user = Auth.getUser();
    if (!user || !Auth.canEdit()) {
      return Promise.reject(new Error('Solo un editor o administrador puede editar playlists.'));
    }

    return SupabaseClient
      .from('playlists')
      .update({
        name: name,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, name, description, share_token')
      .single()
      .then(function (playlistResult) {
        if (playlistResult.error) throw playlistResult.error;
        return SupabaseClient.from('playlist_songs').delete().eq('playlist_id', id)
          .then(function (deleteResult) {
            if (deleteResult.error) throw deleteResult.error;
            return insertSongs(playlistResult.data, selections);
          });
      });
  }

  function loadShared(token) {
    return SupabaseClient
      .rpc('get_shared_playlist', { requested_token: token })
      .then(function (result) {
        if (result.error) throw result.error;
        const rows = result.data || [];
        if (rows.length === 0) return null;
        return {
          name: rows[0].playlist_name,
          description: rows[0].playlist_description || '',
          songs: rows.sort(function (a, b) { return a.song_position - b.song_position; }).map(function (row) {
            return {
              id: row.song_id,
              title: row.song_title,
              artist: row.song_artist || '',
              category: row.song_category || '',
              body: row.song_body || '',
              youtube: row.song_youtube || '',
              slot: row.slot
            };
          })
        };
      });
  }

  function getSlots() {
    return SLOTS.slice();
  }

  function remove(id) {
    const user = Auth.getUser();
    if (!user || !Auth.canEdit()) {
      return Promise.reject(new Error('Solo un editor o administrador puede eliminar playlists.'));
    }

    return SupabaseClient
      .from('playlists')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .then(function (result) {
        if (result.error) throw result.error;
        return true;
      });
  }

  function getShareUrl(token) {
    return window.location.origin + window.location.pathname + '#playlist=' + encodeURIComponent(token);
  }

  return {
    loadAll: loadAll,
    loadShared: loadShared,
    create: create,
    update: update,
    remove: remove,
    getSlots: getSlots,
    getShareUrl: getShareUrl
  };
})();
