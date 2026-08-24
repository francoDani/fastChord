document.addEventListener('DOMContentLoaded', function () {

  const els = UI.getElements();
  const sharedMatch = window.location.hash.match(/^#playlist=([^&]+)$/);
  if (sharedMatch) {
    initSharedPlaylist(decodeURIComponent(sharedMatch[1]));
    return;
  }

  const authButton = document.getElementById('btn-auth');
  const authUser = document.getElementById('auth-user');

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
    loadPlaylists(signedIn);
  }

  function loadPlaylists(signedIn) {
    const list = document.getElementById('playlist-list');
    if (!signedIn) {
      list.innerHTML = '';
      return;
    }
    Playlists.loadAll().then(function (playlists) {
      list.innerHTML = '';
      playlists.forEach(function (playlist) {
        const item = document.createElement('li');
        item.textContent = playlist.name;
        item.title = 'Abrir playlist';
        item.addEventListener('click', function () { openPlaylist(playlist); });
        list.appendChild(item);
      });
    }).catch(function (error) {
      console.error('Error cargando playlists', error);
    });
  }

  function openPlaylist(playlist) {
    const songs = (playlist.playlist_songs || []).slice().sort(function (a, b) {
      return a.position - b.position;
    }).map(function (item) { return item.songs; }).filter(Boolean);
    document.getElementById('playlist-view-title').textContent = playlist.name;
    document.getElementById('playlist-view-description').textContent = playlist.description || '';
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
  }

  function buildPlaylistSlots() {
    const container = document.getElementById('playlist-slots');
    const songs = Storage.getAll();
    container.innerHTML = '';
    Playlists.getSlots().forEach(function (slot) {
      const label = document.createElement('label');
      label.textContent = slot.label + (slot.required ? ' *' : '');
      if (slot.multiple) {
        const dropdown = document.createElement('details');
        dropdown.className = 'playlist-multi-dropdown';
        dropdown.dataset.slot = slot.key;
        const summary = document.createElement('summary');
        summary.textContent = 'Seleccionar canciones';
        dropdown.appendChild(summary);
        const options = document.createElement('div');
        options.className = 'playlist-multi-options';
        songs.filter(function (song) {
          return (song.category || '').split(',').some(function (category) {
            return normalizeCategory(category) === normalizeCategory(slot.label);
          });
        }).forEach(function (song) {
          const optionLabel = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = song.id;
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
        songs.filter(function (song) {
          return (song.category || '').split(',').some(function (category) {
            return normalizeCategory(category) === normalizeCategory(slot.label);
          });
        }).forEach(function (song) {
          const option = document.createElement('option');
          option.value = song.id;
          option.textContent = song.title;
          select.appendChild(option);
        });
        if (slot.required) select.required = true;
        label.appendChild(select);
      }
      container.appendChild(label);
    });
  }

  function normalizeCategory(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    buildPlaylistSlots();
    UI.showView('playlist-form');
  });

  document.getElementById('btn-back-playlists').addEventListener('click', function () {
    UI.showView('empty');
  });

  document.getElementById('btn-cancel-playlist').addEventListener('click', function () {
    UI.showView('empty');
  });

  document.getElementById('form-playlist').addEventListener('submit', function (event) {
    event.preventDefault();
    const selections = {};
    document.querySelectorAll('#playlist-slots select, #playlist-slots .playlist-multi-dropdown').forEach(function (control) {
      if (control.classList.contains('playlist-multi-dropdown')) {
        selections[control.dataset.slot] = Array.prototype.slice.call(control.querySelectorAll('input:checked'))
          .map(function (input) { return input.value; });
      } else {
        selections[control.dataset.slot] = control.value ? [control.value] : [];
      }
    });
    Playlists.create(document.getElementById('playlist-name').value.trim(), selections)
      .then(function (playlist) {
        UI.showView('empty');
        loadPlaylists(true);
        alert('Playlist creada. Link: ' + Playlists.getShareUrl(playlist.share_token));
      })
      .catch(function (error) {
        console.error('Error creando playlist', error);
        alert('No se pudo crear la playlist: ' + (error.message || error));
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
  let isAutoScrolling = false;
  const SCROLL_SPEED = 1.2;
  const SCROLL_INTERVAL = 50;

  const btnAutoScroll = document.getElementById('btn-autoscroll');
  const chordDisplay = document.getElementById('chord-display');
  const songView = document.getElementById('song-view');

  btnAutoScroll.addEventListener('click', function () {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  });

  function startAutoScroll() {
    if (songView.classList.contains('hidden')) return;

    isAutoScrolling = true;
    btnAutoScroll.classList.add('active');
    btnAutoScroll.textContent = '■';
    btnAutoScroll.title = 'Detener Auto-scroll';

    // Activa el modo inmersivo ocultando header y notas
    songView.classList.add('autoscrolling');

    autoScrollInterval = setInterval(function () {
      if (chordDisplay.scrollTop + chordDisplay.clientHeight >= chordDisplay.scrollHeight - 5) {
        stopAutoScroll();
        return;
      }
      chordDisplay.scrollTop += SCROLL_SPEED;
    }, SCROLL_INTERVAL);
  }

  function stopAutoScroll() {
    isAutoScrolling = false;
    btnAutoScroll.classList.remove('active');
    btnAutoScroll.textContent = '▶';
    btnAutoScroll.title = 'Auto-scroll';

    // Restaura la vista completa mostrando header y notas
    songView.classList.remove('autoscrolling');

    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
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
      document.getElementById('shared-chord-display').innerHTML = ChordPro.render(song.body, 0);
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