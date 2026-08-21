document.addEventListener('DOMContentLoaded', function () {
  UI.refreshList();

  const els = UI.getElements();

  // Búsqueda
  els.searchInput.addEventListener('input', function () {
    UI.refreshList(this.value, els.categoryFilter.value);
  });

  // Filtro
  els.categoryFilter.addEventListener('change', function () {
    UI.refreshList(els.searchInput.value, this.value);
  });

  // Nueva
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

  // Guardar
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

    if (UI.getCurrentSongId()) {
      Storage.update(UI.getCurrentSongId(), data);
    } else {
      const newSong = Storage.add(data);
      UI.selectSong(newSong.id);
    }

    UI.refreshList(els.searchInput.value, els.categoryFilter.value);
    if (UI.getCurrentSongId()) UI.selectSong(UI.getCurrentSongId());
  });

  // Editar
  document.getElementById('btn-edit').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
    const song = Storage.getAll().find(function (s) { return s.id === id; });
    UI.openForm(song);
    
    if (window.stopAutoScroll) window.stopAutoScroll();
  });

  // Eliminar
  document.getElementById('btn-delete').addEventListener('click', function () {
    const id = UI.getCurrentSongId();
    if (!id) return;
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

  // TXT
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

  // Empezar colapsado en tablets
  if (window.innerWidth < 900) {
    sidebar.classList.add('collapsed');
    btnToggle.textContent = '☰';
  }
    // ====================== AUTO-SCROLL ======================
  let autoScrollInterval = null;
  let isAutoScrolling = false;
  const SCROLL_SPEED = 1.2; // píxeles por tick (ajusta si quieres más lento/rápido)
  const SCROLL_INTERVAL = 50; // ms (más bajo = más suave)

  const btnAutoScroll = document.getElementById('btn-autoscroll');
  const chordDisplay = document.getElementById('chord-display');

  btnAutoScroll.addEventListener('click', function () {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  });

  function startAutoScroll() {
    // Solo funciona si hay una canción visible
    if (document.getElementById('song-view').classList.contains('hidden')) {
      return;
    }

    isAutoScrolling = true;
    btnAutoScroll.classList.add('active');
    btnAutoScroll.textContent = '■ Stop';
    btnAutoScroll.title = 'Detener Auto-scroll';

    autoScrollInterval = setInterval(function () {
      // Si ya llegó al final → detener
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
    btnAutoScroll.textContent = '▶ Auto';
    btnAutoScroll.title = 'Auto-scroll';

    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  // Detener auto-scroll cuando se cambia de canción o se edita
  // (se puede llamar desde otros sitios si quieres)
  window.stopAutoScroll = stopAutoScroll;
});