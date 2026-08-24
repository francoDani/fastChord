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

  function create(name, selections) {
    const user = Auth.getUser();
    if (!user || !Auth.canEdit()) {
      return Promise.reject(new Error('Solo un editor o administrador puede crear playlists.'));
    }

    return SupabaseClient
      .from('playlists')
      .insert({ name: name, description: '', created_by: user.id })
      .select('id, name, description, share_token')
      .single()
      .then(function (playlistResult) {
        if (playlistResult.error) throw playlistResult.error;
        const rows = [];
        let position = 0;
        SLOTS.forEach(function (slot) {
          (selections[slot.key] || []).forEach(function (songId) {
            rows.push({ playlist_id: playlistResult.data.id, song_id: songId, slot: slot.key, position: position++ });
          });
        });
        if (rows.length === 0) return playlistResult.data;
        return SupabaseClient.from('playlist_songs').insert(rows).then(function (songsResult) {
          if (songsResult.error) throw songsResult.error;
          return playlistResult.data;
        });
      });
  }

  function getSlots() {
    return SLOTS.slice();
  }

  function getShareUrl(token) {
    return window.location.origin + window.location.pathname + '#playlist=' + encodeURIComponent(token);
  }

  return { loadAll: loadAll, create: create, getSlots: getSlots, getShareUrl: getShareUrl };
})();
