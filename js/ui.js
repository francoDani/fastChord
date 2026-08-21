const UI = (function () {
  let currentSongId = null;
  let currentTranspose = 0;
  let songsCache = [];

  const els = {
    songList: document.getElementById('song-list'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    emptyState: document.getElementById('empty-state'),
    songView: document.getElementById('song-view'),
    songForm: document.getElementById('song-form'),
    chordDisplay: document.getElementById('chord-display'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    songCategory: document.getElementById('song-category'),
    songNotes: document.getElementById('song-notes'),
    transposeValue: document.getElementById('transpose-value'),
    btnYoutube: document.getElementById('btn-youtube'),
    formTitle: document.getElementById('form-title'),
    formTitleInput: document.getElementById('form-title-input'),
    formArtist: document.getElementById('form-artist'),
    formCategory: document.getElementById('form-category'),
    formYoutube: document.getElementById('form-youtube'),
    formBody: document.getElementById('form-body'),
    categoryList: document.getElementById('category-list')
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function refreshList(filterText, category) {
    filterText = filterText || '';
    category = category || '';
    songsCache = Storage.getAll();
    songsCache.sort(function (a, b) {
      return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
    });

    let filtered = songsCache;

    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = filtered.filter(function (s) {
        return (s.title && s.title.toLowerCase().indexOf(q) !== -1) ||
          (s.artist && s.artist.toLowerCase().indexOf(q) !== -1);
      });
    }

    if (category) {
      filtered = filtered.filter(function (s) { return s.category === category; });
    }

    els.songList.innerHTML = '';
    filtered.forEach(function (song) {
      const li = document.createElement('li');
      li.dataset.id = song.id;
      if (song.id === currentSongId) li.className = 'active';
      li.innerHTML = '<span class="title">' + escapeHtml(song.title) + '</span>' +
        '<span class="artist">' + escapeHtml(song.artist || '') + '</span>';
      li.addEventListener('click', function () { selectSong(song.id); });
      els.songList.appendChild(li);
    });

    updateCategoryFilter();
  }

  function updateCategoryFilter() {
    const cats = [];
    songsCache.forEach(function (s) {
      if (s.category && cats.indexOf(s.category) === -1) cats.push(s.category);
    });
    cats.sort();

    const current = els.categoryFilter.value;
    els.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    cats.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      els.categoryFilter.appendChild(opt);
    });
    els.categoryFilter.value = current;

    els.categoryList.innerHTML = '';
    cats.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c;
      els.categoryList.appendChild(opt);
    });
  }

  function selectSong(id) {
    if (window.stopAutoScroll) window.stopAutoScroll();

    currentSongId = id;
    currentTranspose = 0;
    const allSongs = Storage.getAll();
    const song = allSongs.find(function (s) { return s.id === id; });
    if (!song) return;

    songsCache = allSongs;

    const items = document.querySelectorAll('#song-list li');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].dataset.id === id);
    }

    showView('view');
    els.songTitle.textContent = song.title;
    els.songArtist.textContent = song.artist || '';
    els.songCategory.textContent = song.category || '';
    els.songCategory.style.display = song.category ? 'inline-block' : 'none';
    els.songNotes.value = song.notes || '';
    els.transposeValue.textContent = '0';

    if (song.youtube) {
      els.btnYoutube.href = song.youtube;
      els.btnYoutube.style.display = 'inline-block';
    } else {
      els.btnYoutube.style.display = 'none';
    }

    renderChords(song.body || '', 0);
    if (window.stopAutoScroll) window.stopAutoScroll();
  }

  function renderChords(body, transpose) {
    els.chordDisplay.innerHTML = ChordPro.render(body, transpose);
  }

  function showView(mode) {
    els.emptyState.classList.add('hidden');
    els.songView.classList.add('hidden');
    els.songForm.classList.add('hidden');

    if (mode === 'view') els.songView.classList.remove('hidden');
    else if (mode === 'form') els.songForm.classList.remove('hidden');
    else els.emptyState.classList.remove('hidden');
  }

  function openForm(song) {
    showView('form');
    if (song) {
      els.formTitle.textContent = 'Editar canción';
      els.formTitleInput.value = song.title || '';
      els.formArtist.value = song.artist || '';
      els.formCategory.value = song.category || '';
      els.formYoutube.value = song.youtube || '';
      els.formBody.value = song.body || '';
      currentSongId = song.id;
    } else {
      els.formTitle.textContent = 'Nueva canción';
      els.formTitleInput.value = '';
      els.formArtist.value = '';
      els.formCategory.value = '';
      els.formYoutube.value = '';
      els.formBody.value = '';
      currentSongId = null;
    }
  }

  els.songNotes.addEventListener('input', function () {
    if (!currentSongId) return;
    Storage.update(currentSongId, { notes: this.value });
  });

  return {
    refreshList: refreshList,
    selectSong: selectSong,
    openForm: openForm,
    showView: showView,
    renderChords: renderChords,
    getCurrentSongId: function () { return currentSongId; },
    getCurrentTranspose: function () { return currentTranspose; },
    setTranspose: function (val) {
      currentTranspose = val;
      els.transposeValue.textContent = val > 0 ? '+' + val : val;
    },
    getElements: function () { return els; }
  };
  // Guardar notas automáticamente + botón manual
  function saveNotes() {
    if (!currentSongId) return;

    const notes = els.songNotes.value;
    Storage.update(currentSongId, { notes: notes });

    // Actualizar también el caché en memoria
    const song = songsCache.find(function (s) { return s.id === currentSongId; });
    if (song) {
      song.notes = notes;
    }

    // Feedback visual rápido
    const btn = document.getElementById('btn-save-notes');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Guardado';
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = original;
        btn.disabled = false;
      }, 1200);
    }
  }

  els.songNotes.addEventListener('input', function () {
    // Guardado automático suave (opcional)
    // saveNotes();   ← puedes descomentar si quieres guardado al escribir
  });

  // Botón de guardado manual
  document.getElementById('btn-save-notes').addEventListener('click', saveNotes);
})();