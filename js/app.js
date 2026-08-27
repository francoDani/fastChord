window.addEventListener('hashchange', function () {
  window.location.reload();
});

document.addEventListener('DOMContentLoaded', function () {

  const els = UI.getElements();
  const sharedMatch = window.location.hash.match(/^#playlist=([^&]+)$/);
  if (sharedMatch) {
    initSharedPlaylist(decodeURIComponent(sharedMatch[1]));
    return;
  }

  const authButton = document.getElementById('btn-auth');
  const authUser = document.getElementById('auth-user');
  const btnEditPlaylist = document.getElementById('btn-edit-playlist');
  const btnDeletePlaylist = document.getElementById('btn-delete-playlist');
  const btnCopyPlaylistLink = document.getElementById('btn-copy-playlist-link');
  let currentPlaylist = null;
  let editingPlaylist = null;

  function setPlaylistEditorActions(visible) {
    btnEditPlaylist.classList.toggle('hidden', !visible);
    btnDeletePlaylist.classList.toggle('hidden', !visible);
  }

  function applyAuthState(state) {
    const signedIn = !!state.user;
    const canEdit = state.role === 'editor' || state.role === 'admin';
    if (!signedIn) Storage.clearLocalData();
    authUser.textContent = signedIn
      ? ((state.profile && state.profile.display_name) || state.user.email)
      : '';
    authButton.textContent = signedIn ? '↪' : '♙';
    authButton.title = signedIn ? 'Cerrar sesión' : 'Iniciar sesión con Google';
    authButton.onclick = function () {
      (signedIn ? Auth.signOut() : Auth.signIn()).catch(function (error) {
        console.error('Error de autenticación', error);
        alert('No se pudo completar la autenticación.');
      });
    };
    UI.setRole(state.role);
    document.getElementById('editor-actions').hidden = !canEdit;
    document.getElementById('playlists-panel').classList.toggle('hidden', !signedIn);
    setPlaylistEditorActions(canEdit && !!currentPlaylist);
    if (!canEdit && editingPlaylist) {
      editingPlaylist = null;
      if (currentPlaylist) openPlaylist(currentPlaylist);
      else UI.showView('empty');
    }
    loadPlaylists(signedIn);
  }

  function loadPlaylists(signedIn) {
    const list = document.getElementById('playlist-list');
    if (!signedIn) {
      list.innerHTML = '';
      currentPlaylist = null;
      return Promise.resolve([]);
    }
    return Playlists.loadAll().then(function (playlists) {
      list.innerHTML = '';
      playlists.forEach(function (playlist) {
        const item = document.createElement('li');
        item.textContent = playlist.name;
        item.title = 'Abrir playlist';
        item.addEventListener('click', function () { openPlaylist(playlist); });
        list.appendChild(item);
      });
      return playlists;
    }).catch(function (error) {
      console.error('Error cargando playlists', error);
      return [];
    });
  }

  function openPlaylist(playlist) {
    currentPlaylist = playlist;
    editingPlaylist = null;
    const songs = (playlist.playlist_songs || []).slice().sort(function (a, b) {
      return a.position - b.position;
    }).map(function (item) { return item.songs; }).filter(Boolean);
    document.getElementById('playlist-view-title').textContent = playlist.name;
    document.getElementById('playlist-view-description').textContent = playlist.description || '';
    setPlaylistEditorActions(Auth.canEdit());
    const list = document.getElementById('playlist-song-list');
    list.innerHTML = '';
    songs.forEach(function (song) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'playlist-song-button';
      button.textContent = song.title;
      button.addEventListener('click', function () {
        UI.selectSong(song.id);
        document.getElementById('sidebar').classList.add('collapsed');
      });
      item.appendChild(button);
      list.appendChild(item);
    });
    UI.showView('playlist-view');
    document.getElementById('sidebar').classList.add('collapsed');
  }

  function selectionsFromPlaylist(playlist) {
    const selections = {};
    Playlists.getSlots().forEach(function (slot) {
      selections[slot.key] = [];
    });
    (playlist.playlist_songs || []).slice().sort(function (a, b) {
      return a.position - b.position;
    }).forEach(function (item) {
      if (!item.slot || !item.song_id) return;
      if (!selections[item.slot]) selections[item.slot] = [];
      selections[item.slot].push(item.song_id);
    });
    return selections;
  }

  let currentPlaylistType = 'misa';
  const MAX_CUSTOM_SONGS = 10;
  const btnTypeMisa = document.getElementById('btn-type-misa');
  const btnTypeCustom = document.getElementById('btn-type-custom');
  const sectionMisa = document.getElementById('playlist-misa-section');
  const sectionCustom = document.getElementById('playlist-custom-section');
  const btnAddCustomSong = document.getElementById('btn-add-custom-song');
  const customContainer = document.getElementById('custom-songs-container');

  function setPlaylistType(type) {
    currentPlaylistType = type || 'misa';
    btnTypeMisa.classList.toggle('active', currentPlaylistType === 'misa');
    btnTypeCustom.classList.toggle('active', currentPlaylistType === 'custom');
    sectionMisa.classList.toggle('hidden', currentPlaylistType !== 'misa');
    sectionCustom.classList.toggle('hidden', currentPlaylistType !== 'custom');

    const isMisa = currentPlaylistType === 'misa';
    const misaControls = sectionMisa.querySelectorAll('select, input');
    misaControls.forEach(function (ctrl) {
      if (isMisa) {
        const slotKey = ctrl.dataset.slot;
        const slot = Playlists.getSlots().find(function (s) { return s.key === slotKey; });
        if (slot && slot.required) {
          ctrl.required = true;
        }
        ctrl.disabled = false;
      } else {
        ctrl.required = false;
        ctrl.disabled = true;
      }
    });

    const customControls = sectionCustom.querySelectorAll('select, input');
    customControls.forEach(function (ctrl) {
      ctrl.disabled = !isMisa ? false : true;
    });
  }

  if (btnTypeMisa && btnTypeCustom) {
    btnTypeMisa.addEventListener('click', function () { setPlaylistType('misa'); });
    btnTypeCustom.addEventListener('click', function () {
      setPlaylistType('custom');
      if (customContainer.children.length === 0) {
        addCustomSongRow();
      }
    });
  }

  function updateAddCustomSongBtnState() {
    if (!btnAddCustomSong || !customContainer) return;
    const count = customContainer.children.length;
    btnAddCustomSong.disabled = count >= MAX_CUSTOM_SONGS;
    if (count >= MAX_CUSTOM_SONGS) {
      btnAddCustomSong.textContent = 'Límite alcanzado (máx 10 canciones)';
    } else {
      btnAddCustomSong.textContent = '+ Agregar canción (' + count + '/' + MAX_CUSTOM_SONGS + ')';
    }
  }

  function addCustomSongRow(selectedSongId) {
    if (!customContainer || customContainer.children.length >= MAX_CUSTOM_SONGS) return;

    const rowIndex = customContainer.children.length + 1;
    const row = document.createElement('div');
    row.className = 'custom-song-row';

    const label = document.createElement('label');
    label.textContent = 'Canción ' + rowIndex;

    const select = document.createElement('select');
    select.className = 'custom-song-select';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Seleccionar canción';
    select.appendChild(emptyOption);

    const allSongs = Storage.getAll().slice().sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });

    allSongs.forEach(function (song) {
      const option = document.createElement('option');
      option.value = song.id;
      option.textContent = song.title + (song.artist ? ' (' + song.artist + ')' : '');
      if (selectedSongId && song.id === selectedSongId) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    label.appendChild(select);
    row.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-row';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Eliminar canción';
    removeBtn.addEventListener('click', function () {
      customContainer.removeChild(row);
      renumberCustomSongRows();
      updateAddCustomSongBtnState();
    });
    row.appendChild(removeBtn);

    customContainer.appendChild(row);
    updateAddCustomSongBtnState();

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renumberCustomSongRows() {
    if (!customContainer) return;
    Array.prototype.forEach.call(customContainer.children, function (row, index) {
      const label = row.querySelector('label');
      if (label) {
        const select = label.querySelector('select');
        label.textContent = 'Canción ' + (index + 1);
        if (select) label.appendChild(select);
      }
    });
  }

  if (btnAddCustomSong) {
    btnAddCustomSong.addEventListener('click', function () {
      addCustomSongRow();
    });
  }

  function songsForSlot(slot, selectedIds) {
    const allSongs = Storage.getAll();
    const selectedLookup = {};
    (selectedIds || []).forEach(function (id) { selectedLookup[id] = true; });
    const result = [];
    const seen = {};
    const targetCategory = slot.categoryFilter || slot.label;
    const targetNorm = normalizeCategory(targetCategory);

    allSongs.forEach(function (song) {
      if (seen[song.id]) return;
      const songCategories = (song.category || '').split(',').map(function (c) {
        return normalizeCategory(c);
      });
      const matchesCategory = songCategories.indexOf(targetNorm) !== -1;
      if (matchesCategory || selectedLookup[song.id]) {
        seen[song.id] = true;
        result.push(song);
      }
    });

    result.sort(function (a, b) {
      return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
    });

    return result;
  }

  function openPlaylistForm(playlist) {
    editingPlaylist = playlist || null;
    document.getElementById('playlist-form-title').textContent = playlist ? 'Editar playlist' : 'Nueva playlist';
    document.getElementById('btn-save-playlist').textContent = playlist ? 'Guardar playlist' : 'Crear playlist';
    document.getElementById('playlist-name').value = playlist ? (playlist.name || '') : '';

    const type = playlist ? (playlist.type || 'misa') : 'misa';

    buildPlaylistSlots(playlist ? selectionsFromPlaylist(playlist) : {});

    if (customContainer) {
      customContainer.innerHTML = '';
      if (playlist && type === 'custom') {
        const songs = (playlist.playlist_songs || []).slice().sort(function (a, b) {
          return a.position - b.position;
        });
        if (songs.length > 0) {
          songs.forEach(function (item) {
            addCustomSongRow(item.song_id);
          });
        } else {
          addCustomSongRow();
        }
      } else {
        addCustomSongRow();
      }
    }

    setPlaylistType(type);
    UI.showView('playlist-form');
  }

  function buildPlaylistSlots(selectedBySlot) {
    selectedBySlot = selectedBySlot || {};
    const container = document.getElementById('playlist-slots');
    container.innerHTML = '';
    Playlists.getSlots().forEach(function (slot) {
      const selectedIds = selectedBySlot[slot.key] || [];
      const slotSongs = songsForSlot(slot, selectedIds);
      const label = document.createElement('label');
      label.textContent = slot.label + (slot.required ? ' *' : '');
      if (slot.multiple) {
        const dropdown = document.createElement('details');
        dropdown.className = 'playlist-multi-dropdown';
        dropdown.dataset.slot = slot.key;
        const summary = document.createElement('summary');
        summary.textContent = selectedIds.length
          ? (selectedIds.length + ' canciones')
          : 'Seleccionar canciones';
        dropdown.appendChild(summary);
        const options = document.createElement('div');
        options.className = 'playlist-multi-options';
        slotSongs.forEach(function (song) {
          const optionLabel = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = song.id;
          checkbox.checked = selectedIds.indexOf(song.id) !== -1;
          optionLabel.appendChild(checkbox);
          optionLabel.appendChild(document.createTextNode(song.title));
          options.appendChild(optionLabel);
        });
        dropdown.appendChild(options);
        label.appendChild(dropdown);
      } else {
        const select = document.createElement('select');
        select.dataset.slot = slot.key;
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Seleccionar canción';
        select.appendChild(empty);
        slotSongs.forEach(function (song) {
          const option = document.createElement('option');
          option.value = song.id;
          option.textContent = song.title;
          select.appendChild(option);
        });
        select.value = selectedIds[0] || '';
        if (slot.required) select.required = true;
        label.appendChild(select);
      }
      container.appendChild(label);
    });
  }

  function normalizeCategory(value) {
    if (!value) return '';
    return value.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, text.length);
      try {
        if (!document.execCommand('copy')) throw new Error('copy failed');
        resolve();
      } catch (error) {
        reject(error);
      }
      document.body.removeChild(input);
    });
  }

  Auth.init(applyAuthState)
    .catch(function (error) {
      console.error('No se pudo inicializar la autenticación', error);
      applyAuthState({ user: null, profile: null, role: 'readonly' });
    })
    .then(function () {
      return Storage.loadDefaultSongs();
    })
    .then(function (count) {
      if (count > 0) {
        console.log('Se cargaron ' + count + ' canciones');
      }
      UI.refreshList();
    });

  document.getElementById('actions-menu-content').addEventListener('click', function (event) {
    let element = event.target;
    while (element && element !== this && element.tagName !== 'BUTTON') {
      element = element.parentNode;
    }
    if (element && element.tagName === 'BUTTON') {
      document.getElementById('editor-actions').open = false;
    }
  });

  // Búsqueda
  els.searchInput.addEventListener('input', function () {
    UI.refreshList(this.value, els.categoryFilter.value);
  });

  // Filtro
  els.categoryFilter.addEventListener('change', function () {
    UI.refreshList(els.searchInput.value, this.value);
  });

  // Nueva canción
  document.getElementById('btn-new').addEventListener('click', function () {
    UI.openForm();
    sidebar.classList.add('collapsed');
  });

  document.getElementById('btn-new-playlist').addEventListener('click', function () {
    openPlaylistForm();
    sidebar.classList.add('collapsed');
  });

  document.getElementById('btn-edit-playlist').addEventListener('click', function () {
    if (!currentPlaylist || !Auth.canEdit()) return;
    openPlaylistForm(currentPlaylist);
  });

  document.getElementById('btn-copy-playlist-link').addEventListener('click', function () {
    if (!currentPlaylist || !currentPlaylist.share_token) {
      alert('Esta playlist todavía no tiene un link para compartir.');
      return;
    }
    const url = Playlists.getShareUrl(currentPlaylist.share_token);
    copyToClipboard(url).then(function () {
      const originalTitle = btnCopyPlaylistLink.title;
      btnCopyPlaylistLink.title = 'Link copiado';
      btnCopyPlaylistLink.classList.add('copied');
      setTimeout(function () {
        btnCopyPlaylistLink.title = originalTitle;
        btnCopyPlaylistLink.classList.remove('copied');
      }, 1600);
    }).catch(function () {
      window.prompt('Copiá el link de la playlist:', url);
    });
  });

  document.getElementById('btn-delete-playlist').addEventListener('click', function () {
    if (!currentPlaylist || !Auth.canEdit()) return;
    if (!confirm('¿Eliminar esta playlist? Dejará de aparecer para el equipo y el link compartido dejará de funcionar.')) {
      return;
    }
    Playlists.remove(currentPlaylist.id)
      .then(function () {
        currentPlaylist = null;
        editingPlaylist = null;
        setPlaylistEditorActions(false);
        UI.showView('empty');
        return loadPlaylists(true);
      })
      .catch(function (error) {
        console.error('Error eliminando playlist', error);
        alert('No se pudo eliminar la playlist: ' + (error.message || error));
      });
  });

  document.getElementById('btn-back-playlists').addEventListener('click', function () {
    currentPlaylist = null;
    UI.showView('empty');
  });

  document.getElementById('btn-cancel-playlist').addEventListener('click', function () {
    if (currentPlaylist) {
      openPlaylist(currentPlaylist);
      return;
    }
    UI.showView('empty');
  });

  document.getElementById('form-playlist').addEventListener('submit', function (event) {
    event.preventDefault();
    const selections = {};
    const name = document.getElementById('playlist-name').value.trim();

    if (currentPlaylistType === 'custom') {
      const customSongIds = [];
      document.querySelectorAll('#custom-songs-container select').forEach(function (select) {
        if (select.value) customSongIds.push(select.value);
      });
      if (customSongIds.length === 0) {
        alert('Debes seleccionar al menos una canción para la playlist custom.');
        return;
      }
      selections.custom = customSongIds;
    } else {
      document.querySelectorAll('#playlist-slots select, #playlist-slots .playlist-multi-dropdown').forEach(function (control) {
        if (control.classList.contains('playlist-multi-dropdown')) {
          selections[control.dataset.slot] = Array.prototype.slice.call(control.querySelectorAll('input:checked'))
            .map(function (input) { return input.value; });
        } else {
          selections[control.dataset.slot] = control.value ? [control.value] : [];
        }
      });
    }

    const isEditing = !!editingPlaylist;
    const saveRequest = isEditing
      ? Playlists.update(editingPlaylist.id, name, currentPlaylistType, selections)
      : Playlists.create(name, currentPlaylistType, selections);

    saveRequest
      .then(function (playlist) {
        return loadPlaylists(true).then(function (playlists) {
          const saved = playlists.filter(function (item) { return item.id === playlist.id; })[0] || playlist;
          if (isEditing) {
            openPlaylist(saved);
          } else {
            currentPlaylist = null;
            editingPlaylist = null;
            UI.showView('empty');
            alert('Playlist creada. Link: ' + Playlists.getShareUrl(playlist.share_token));
          }
        });
      })
      .catch(function (error) {
        console.error(isEditing ? 'Error editando playlist' : 'Error creando playlist', error);
        alert((isEditing ? 'No se pudo guardar la playlist: ' : 'No se pudo crear la playlist: ') + (error.message || error));
      });
  });

  // Cancelar
  document.getElementById('btn-cancel').addEventListener('click', function () {
    if (UI.getCurrentSongId()) {
      UI.selectSong(UI.getCurrentSongId());
    } else {
      UI.showView('empty');
    }
  });

  // Guardar formulario
  document.getElementById('form-song').addEventListener('submit', function (e) {
    e.preventDefault();
    const data = {
      title: els.formTitleInput.value.trim(),
      artist: els.formArtist.value.trim(),
      category: els.formCategory.value,
      youtube: els.formYoutube.value.trim(),
      body: els.formBody.value
    };

    if (!data.title) {
      alert('El título es obligatorio');
      return;
    }

    const saveRequest = UI.getCurrentSongId()
      ? Storage.update(UI.getCurrentSongId(), data)
      : Storage.add(data);

    Promise.resolve(saveRequest)
      .then(function (savedSong) {
        UI.refreshList(els.searchInput.value, els.categoryFilter.value);
        UI.selectSong(savedSong.id);
      })
      .catch(function (error) {
        console.error('Error guardando canción', error);
        alert('No se pudo guardar la canción: ' + (error.message || error));
      });
  });

  // Editar
  document.getElementById('btn-edit').addEventListener('click', function () {
    if (window.stopAutoScroll) window.stopAutoScroll();
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    if (!song || !Auth.canEdit() || !isCloudSongId(song.id)) return;
    UI.openForm(song);
  });

  // Eliminar
  document.getElementById('btn-delete').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    if (!song || !Auth.canEdit() || !isCloudSongId(song.id)) return;
    if (confirm('¿Eliminar esta canción?')) {
      Storage.remove(id)
        .then(function () {
          UI.showView('empty');
          UI.refreshList(els.searchInput.value, els.categoryFilter.value);
        })
        .catch(function (error) {
          console.error('Error eliminando canción', error);
          alert('No se pudo eliminar la canción: ' + (error.message || error));
        });
    }
  });

  function isCloudSongId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  // Transposición
  document.getElementById('btn-transpose-up').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    const newVal = UI.getCurrentTranspose() + 1;
    UI.setTranspose(newVal);
    UI.renderChords(song.body || '', newVal);
  });

  document.getElementById('btn-transpose-down').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    const newVal = UI.getCurrentTranspose() - 1;
    UI.setTranspose(newVal);
    UI.renderChords(song.body || '', newVal);
  });

  // JSON
  document.getElementById('btn-export-json').addEventListener('click', function () {
    Storage.exportJSON();
  });

  document.getElementById('btn-import-json').addEventListener('click', function () {
    document.getElementById('import-json-file').click();
  });

  document.getElementById('import-json-file').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    Storage.importJSON(file)
      .then(function (count) {
        alert('Se importaron ' + count + ' canciones desde JSON');
        UI.refreshList();
        UI.showView('empty');
      })
      .catch(function (err) {
        alert('Error al importar JSON: ' + err.message);
      });
    this.value = '';
  });

  // TXT / OnSong
  document.getElementById('btn-export-txt').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) {
      if (confirm('No hay canción seleccionada.\n¿Exportar TODAS las canciones como .txt?')) {
        Storage.exportAllAsTxt();
      }
      return;
    }
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    Storage.exportSongAsTxt(song);
  });

  document.getElementById('btn-import-txt').addEventListener('click', function () {
    document.getElementById('import-txt-files').click();
  });

  document.getElementById('import-txt-files').addEventListener('change', function (e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Storage.importTxtFiles(files)
      .then(function (added) {
        alert('Se importaron ' + added + ' canciones nuevas');
        UI.refreshList();
      });
    this.value = '';
  });

  // Sidebar colapsable
  const sidebar = document.getElementById('sidebar');
  const btnToggle = document.getElementById('btn-toggle-sidebar');

  btnToggle.addEventListener('click', function () {
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
      btnToggle.textContent = '☰';
      btnToggle.title = 'Mostrar lista';
    } else {
      btnToggle.textContent = '✕';
      btnToggle.title = 'Ocultar lista';
    }
  });

  document.getElementById('song-list').addEventListener('click', function () {
    sidebar.classList.add('collapsed');
    btnToggle.textContent = '☰';
    btnToggle.title = 'Mostrar lista';
  });

  if (window.innerWidth < 900) {
    sidebar.classList.add('collapsed');
    btnToggle.textContent = '☰';
  }

  // ====================== AUTO-SCROLL ======================
  let autoScrollInterval = null;
  let autoScrollDelayTimer = null;
  let isAutoScrolling = false;
  let autoScrollRemainingDelay = 0;

  const AUTO_SCROLL_DELAY_SEC = 15;
  const SCROLL_INTERVAL = 50;

  // 5 Niveles de Velocidad (Velocidad 4 = 1.2px/50ms, la configuración actual como 2da más rápida)
  const SPEED_LEVELS = [
    { level: 1, label: '1x', speed: 0.4, name: '1 (Muy Lenta)' },
    { level: 2, label: '2x', speed: 0.6, name: '2 (Lenta)' },
    { level: 3, label: '3x', speed: 0.9, name: '3 (Media)' },
    { level: 4, label: '4x', speed: 1.2, name: '4 (Rápida)' },
    { level: 5, label: '5x', speed: 1.6, name: '5 (Muy Rápida)' }
  ];

  let currentSpeedIndex = parseInt(localStorage.getItem('fastchord_autoscroll_speed') || '3', 10);
  if (isNaN(currentSpeedIndex) || currentSpeedIndex < 0 || currentSpeedIndex >= SPEED_LEVELS.length) {
    currentSpeedIndex = 3; // Nivel 4 por defecto (índice 3)
  }

  const btnAutoScroll = document.getElementById('btn-autoscroll');
  const btnAutoScrollSpeed = document.getElementById('btn-autoscroll-speed');
  const chordDisplay = document.getElementById('chord-display');
  const songView = document.getElementById('song-view');

  function updateSpeedButtonUI() {
    if (!btnAutoScrollSpeed) return;
    const currentConfig = SPEED_LEVELS[currentSpeedIndex];
    btnAutoScrollSpeed.textContent = currentConfig.label;
    btnAutoScrollSpeed.title = 'Velocidad de scroll: ' + currentConfig.name + ' (Clic para cambiar)';
  }

  if (btnAutoScrollSpeed) {
    updateSpeedButtonUI();
    btnAutoScrollSpeed.addEventListener('click', function () {
      currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_LEVELS.length;
      localStorage.setItem('fastchord_autoscroll_speed', currentSpeedIndex);
      updateSpeedButtonUI();
    });
  }

  btnAutoScroll.addEventListener('click', function () {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScrollWithDelay();
    }
  });

  function startAutoScrollWithDelay() {
    if (songView.classList.contains('hidden')) return;

    isAutoScrolling = true;
    autoScrollRemainingDelay = AUTO_SCROLL_DELAY_SEC;

    btnAutoScroll.classList.add('active', 'delaying');
    btnAutoScroll.textContent = '⏱️ ' + autoScrollRemainingDelay + 's';
    btnAutoScroll.title = 'Auto-scroll iniciará en ' + autoScrollRemainingDelay + 's... (Clic para cancelar)';

    autoScrollDelayTimer = setInterval(function () {
      autoScrollRemainingDelay--;
      if (autoScrollRemainingDelay > 0) {
        btnAutoScroll.textContent = '⏱️ ' + autoScrollRemainingDelay + 's';
        btnAutoScroll.title = 'Auto-scroll iniciará en ' + autoScrollRemainingDelay + 's... (Clic para cancelar)';
      } else {
        clearInterval(autoScrollDelayTimer);
        autoScrollDelayTimer = null;
        startScrollingMotion();
      }
    }, 1000);
  }

  function startScrollingMotion() {
    btnAutoScroll.classList.remove('delaying');
    btnAutoScroll.classList.add('active');
    btnAutoScroll.textContent = '■';
    btnAutoScroll.title = 'Detener Auto-scroll';

    // Activa el modo inmersivo ocultando header y notas
    songView.classList.add('autoscrolling');

    const currentSpeed = SPEED_LEVELS[currentSpeedIndex].speed;

    autoScrollInterval = setInterval(function () {
      if (chordDisplay.scrollTop + chordDisplay.clientHeight >= chordDisplay.scrollHeight - 5) {
        stopAutoScroll();
        return;
      }
      chordDisplay.scrollTop += currentSpeed;
    }, SCROLL_INTERVAL);
  }

  function stopAutoScroll() {
    isAutoScrolling = false;

    if (autoScrollDelayTimer) {
      clearInterval(autoScrollDelayTimer);
      autoScrollDelayTimer = null;
    }

    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }

    btnAutoScroll.classList.remove('active', 'delaying');
    btnAutoScroll.textContent = '▶';
    btnAutoScroll.title = 'Auto-scroll (Con 15s de espera)';

    // Restaura la vista completa mostrando header y notas
    songView.classList.remove('autoscrolling');
  }

  window.stopAutoScroll = stopAutoScroll;
});

// ====================== TOGGLE ACORDES ======================
const btnToggleChords = document.getElementById('btn-toggle-chords');
const chordDisplay = document.getElementById('chord-display');

if (btnToggleChords) {
  btnToggleChords.addEventListener('click', function () {
    chordDisplay.classList.toggle('hide-chords');
    const isHidden = chordDisplay.classList.contains('hide-chords');

    // Cambiar el icono o estado visual del botón según prefieras
    btnToggleChords.classList.toggle('active', isHidden);
    btnToggleChords.title = isHidden ? "Mostrar acordes" : "Ocultar acordes";
  });
}

function initSharedPlaylist(token) {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('btn-toggle-sidebar').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('song-view').classList.add('hidden');
  document.getElementById('song-form').classList.add('hidden');
  document.getElementById('playlist-form').classList.add('hidden');
  document.getElementById('playlist-view').classList.add('hidden');
  const view = document.getElementById('shared-playlist-view');
  view.classList.remove('hidden');
  const list = document.getElementById('shared-song-list');
  const reader = document.getElementById('shared-song-reader');
  const title = document.getElementById('shared-playlist-title');
  const description = document.getElementById('shared-playlist-description');
  let songs = [];
  let currentIndex = 0;

  function showSong(index) {
    currentIndex = index;
    const song = songs[currentIndex];
    if (!song) return;

    document.getElementById('shared-song-title').textContent = song.title;
    const display = document.getElementById('shared-chord-display');
    display.innerHTML = ChordPro.render(song.body, 0);
    display.classList.add('hide-chords');

    // Reset de scroll al inicio de la canción
    display.scrollTop = 0;
    if (reader) reader.scrollTop = 0;
    if (view) view.scrollTop = 0;
    window.scrollTo(0, 0);

    document.getElementById('shared-song-position').textContent = (currentIndex + 1) + ' / ' + songs.length;
    document.getElementById('shared-prev').disabled = currentIndex === 0;
    document.getElementById('shared-next').disabled = currentIndex === songs.length - 1;

    Array.prototype.forEach.call(list.children, function (item, itemIndex) {
      item.classList.toggle('active', itemIndex === currentIndex);
    });
  }

  Playlists.loadShared(token).then(function (playlist) {
    if (!playlist) throw new Error('El cancionero no existe o ya no está disponible.');
    songs = playlist.songs;
    title.textContent = playlist.name;
    description.textContent = playlist.description;
    list.innerHTML = '';
    songs.forEach(function (song, index) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shared-song-button';
      button.textContent = song.title;
      button.addEventListener('click', function () { showSong(index); });
      item.appendChild(button);
      list.appendChild(item);
    });
    reader.classList.toggle('hidden', songs.length === 0);
    showSong(0);
  }).catch(function (error) {
    title.textContent = 'Cancionero no disponible';
    description.textContent = error.message;
    list.innerHTML = '';
    reader.classList.add('hidden');
  });

  document.getElementById('shared-prev').addEventListener('click', function () {
    if (currentIndex > 0) showSong(currentIndex - 1);
  });
  document.getElementById('shared-next').addEventListener('click', function () {
    if (currentIndex < songs.length - 1) showSong(currentIndex + 1);
  });
}