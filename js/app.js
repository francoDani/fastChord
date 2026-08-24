document.addEventListener('DOMContentLoaded', function () {

  const els = UI.getElements();

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
    document.getElementById('btn-new').hidden = !canEdit;
    document.getElementById('btn-import-json').hidden = !canEdit;
    document.getElementById('btn-import-txt').hidden = !canEdit;
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
      category: els.formCategory.value.trim(),
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
        alert('No se pudo guardar la canción.');
      });
  });

  // Editar
  document.getElementById('btn-edit').addEventListener('click', function () {
    if (window.stopAutoScroll) window.stopAutoScroll();
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    if (!song || song.isDefault || !Auth.canEdit()) return;
    UI.openForm(song);
  });

  // Eliminar
  document.getElementById('btn-delete').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    if (!song || song.isDefault || !Auth.canEdit()) return;
    if (confirm('¿Eliminar esta canción?')) {
      Storage.remove(id);
      UI.showView('empty');
      UI.refreshList(els.searchInput.value, els.categoryFilter.value);
    }
  });

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