const Storage = (function () {
  const KEY = 'cancionero_pro_songs_v1';
  const DEFAULT_NOTES_KEY = 'cancionero_pro_default_notes_v1';
  let defaultSongs = [];

  function getUserSongs() {
    try {
      const data = localStorage.getItem(KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error leyendo localStorage', e);
      return [];
    }
  }

  function getAll() {
    return defaultSongs.concat(getUserSongs());
  }

  function saveAll(songs) {
    localStorage.setItem(KEY, JSON.stringify(songs));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function add(song) {
    const songs = getUserSongs();
    song.id = generateId();
    song.isDefault = false;
    song.createdAt = new Date().toISOString();
    song.updatedAt = song.createdAt;
    songs.push(song);
    saveAll(songs);
    return song;
  }

  function update(id, data) {
    const songs = getUserSongs();
    const idx = songs.findIndex(function (s) { return s.id === id; });
    if (idx === -1) return null;
    songs[idx] = Object.assign({}, songs[idx], data, {
      updatedAt: new Date().toISOString()
    });
    saveAll(songs);
    return songs[idx];
  }

  function remove(id) {
    const songs = getUserSongs().filter(function (s) { return s.id !== id; });
    saveAll(songs);
  }

  function getDefaultNotes() {
    try {
      const data = localStorage.getItem(DEFAULT_NOTES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error leyendo notas de canciones predeterminadas', e);
      return {};
    }
  }

  function saveDefaultNotes(notes) {
    localStorage.setItem(DEFAULT_NOTES_KEY, JSON.stringify(notes));
  }

  function updateNotes(id, notes) {
    const defaultSong = defaultSongs.find(function (song) { return song.id === id; });
    if (defaultSong) {
      const defaultNotes = getDefaultNotes();
      defaultNotes[defaultSong.source] = notes;
      saveDefaultNotes(defaultNotes);
      defaultSong.notes = notes;
      return defaultSong;
    }
    return update(id, { notes: notes });
  }

  function migrateLegacyDefaults(defaultSongsFromFiles) {
    const currentSongs = getUserSongs();
    const defaultNotes = getDefaultNotes();
    const defaultKeys = {};
    defaultSongsFromFiles.forEach(function (song) {
      defaultKeys[(song.title || '').toLowerCase() + '|' + (song.artist || '').toLowerCase()] = song.source;
    });

    const userSongs = currentSongs.filter(function (song) {
      const key = (song.title || '').toLowerCase() + '|' + (song.artist || '').toLowerCase();
      const source = defaultKeys[key];
      if (!source || song.isDefault === false) return true;
      if (song.notes && !defaultNotes[source]) defaultNotes[source] = song.notes;
      return false;
    });

    saveAll(userSongs);
    saveDefaultNotes(defaultNotes);
  }

  // ========== Carga de canciones por defecto ==========
  // ========== Sincronización inteligente de canciones por defecto ==========
  function loadDefaultSongs() {
    return fetch('data/manifest.json')
      .then(function (response) {
        if (!response.ok) throw new Error('No se encontró data/manifest.json');
        return response.json();
      })
      .then(function (fileList) {
        if (!Array.isArray(fileList) || fileList.length === 0) {
          return 0;
        }

        // Cargar todos los archivos .txt del manifest en paralelo
        const promises = fileList.map(function (filename) {
          return fetch('data/songs/' + filename)
            .then(function (res) {
              if (!res.ok) throw new Error('No se pudo cargar ' + filename);
              return res.text();
            })
            .then(function (text) {
              const song = parseChordProText(text, filename);
              song.source = filename;
              return song;
            })
            .catch(function (err) {
              console.warn(err.message);
              return null;
            });
        });

        return Promise.all(promises);
      })
      .then(function (parsedSongs) {
        const validSongs = parsedSongs.filter(function (s) {
          return s && s.title;
        });

        if (validSongs.length === 0) return 0;

        migrateLegacyDefaults(validSongs);
        const defaultNotes = getDefaultNotes();
        defaultSongs = validSongs.map(function (song) {
          const source = song.source;
          return {
            id: 'default:' + source,
            source: source,
            isDefault: true,
            title: song.title,
            artist: song.artist || '',
            category: song.category || '',
            youtube: song.youtube || '',
            body: song.body || '',
            notes: defaultNotes[source] || ''
          };
        });
        return defaultSongs.length;
      })
      .catch(function (err) {
        console.warn('Error al sincronizar canciones:', err.message);
        return 0;
      });
  }

  function prepareAndSave(songs) {
    if (!Array.isArray(songs) || songs.length === 0) return 0;

    const prepared = songs.map(function (s) {
      return {
        id: generateId(),
        title: s.title || 'Sin título',
        artist: s.artist || '',
        category: s.category || '',
        youtube: s.youtube || '',
        body: s.body || '',
        notes: s.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    saveAll(prepared);
    return prepared.length;
  }

  function prepareAndSave(songs) {
    if (!Array.isArray(songs) || songs.length === 0) return 0;

    const prepared = songs.map(function (s) {
      return {
        id: generateId(),
        title: s.title || 'Sin título',
        artist: s.artist || '',
        category: s.category || '',
        youtube: s.youtube || '',
        body: s.body || '',
        notes: s.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    saveAll(prepared);
    return prepared.length;
  }

  // ========== JSON ==========
  function exportJSON() {
    const data = getAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'cancionero_pro_' + dateStamp() + '.json');
  }

  function importJSON(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) throw new Error('El JSON debe ser un array');
          const userSongs = imported.map(function (song) {
            const copy = Object.assign({}, song);
            delete copy.isDefault;
            delete copy.source;
            copy.id = copy.id || generateId();
            copy.isDefault = false;
            return copy;
          });
          saveAll(userSongs);
          resolve(imported.length);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(new Error('Error leyendo el archivo')); };
      reader.readAsText(file);
    });
  }

  // ========== ChordPro / OnSong ==========
  function parseChordProText(text, filename) {
    const lines = text.split(/\r?\n/);
    const meta = {
      title: '',
      artist: '',
      category: '',
      youtube: '',
      key: '',
      body: ''
    };

    const bodyLines = [];
    let foundMeta = false;
    let lineIndex = 0;

    const sectionHeaders = [
      'verse', 'chorus', 'bridge', 'intro', 'outro', 'solo',
      'pre-chorus', 'prechorus', 'interlude', 'tag', 'ending',
      'instrumental', 'coda', 'refrain'
    ];

    lines.forEach(function (rawLine) {
      const line = rawLine.trim();

      // ChordPro {title: ...}
      const chordProMeta = line.match(/^\{(\w+)\s*:\s*(.*?)\}\s*$/i);
      if (chordProMeta) {
        const key = chordProMeta[1].toLowerCase();
        const value = chordProMeta[2].trim();
        if (key === 'title' || key === 't') meta.title = value;
        else if (key === 'artist' || key === 'subtitle' || key === 'st') meta.artist = value;
        else if (key === 'category' || key === 'cat') meta.category = value;
        else if (key === 'youtube' || key === 'yt') meta.youtube = value;
        else if (key === 'key' || key === 'k') meta.key = value;
        foundMeta = true;
        return;
      }

      // OnSong Title: ... / Artist: ...
      const onsongMeta = line.match(/^(\w+)\s*:\s*(.+)$/i);
      if (onsongMeta) {
        const key = onsongMeta[1].toLowerCase();
        const value = onsongMeta[2].trim();
        if (key === 'title' || key === 't') { meta.title = value; foundMeta = true; return; }
        if (key === 'artist' || key === 'a' || key === 'subtitle') { meta.artist = value; foundMeta = true; return; }
        if (key === 'category' || key === 'cat' || key === 'genre') { meta.category = value; foundMeta = true; return; }
        if (key === 'youtube' || key === 'yt') { meta.youtube = value; foundMeta = true; return; }
        if (key === 'key' || key === 'k') { meta.key = value; foundMeta = true; return; }
      }

      // Encabezados de sección
      const cleanSection = line.replace(/^\[|\]$/g, '').trim();
      const lowerSection = cleanSection.toLowerCase();

      if (
        sectionHeaders.some(function (h) {
          if (h === 'solo') {
            return lowerSection === h ||
              lowerSection.startsWith(h + ':') ||
              lowerSection.startsWith(h + ' -');
          }
          return lowerSection === h ||
            lowerSection.startsWith(h + ' ') ||
            lowerSection.startsWith(h + ':') ||
            lowerSection.startsWith(h + ' -');
        }) ||
        /^verse\s*\d*/i.test(cleanSection) ||
        /^chorus\s*\d*/i.test(cleanSection) ||
        /^bridge\s*\d*/i.test(cleanSection) ||
        /^pre-?chorus/i.test(cleanSection)
      ) {
        bodyLines.push('§SECTION§' + cleanSection);
        return;
      }

      if (line === '' || line.startsWith('#') || line.startsWith('//')) {
        bodyLines.push(rawLine);
        return;
      }

      // Heurística OnSong
      if (!foundMeta && !meta.title && lineIndex === 0 && line.length > 0) {
        meta.title = line;
        lineIndex++;
        return;
      }
      if (!foundMeta && !meta.artist && lineIndex === 1 && line.length > 0) {
        meta.artist = line;
        lineIndex++;
        return;
      }

      bodyLines.push(rawLine);
    });

    if (!meta.title && filename) {
      meta.title = filename
        .replace(/\.(txt|cho|crd|chordpro|onsong)$/i, '')
        .replace(/_/g, ' ')
        .trim();
    }

    meta.body = bodyLines.join('\n').trim();
    return meta;
  }

  function songToChordPro(song) {
    let out = '';
    if (song.title) out += '{title: ' + song.title + '}\n';
    if (song.artist) out += '{artist: ' + song.artist + '}\n';
    if (song.category) out += '{category: ' + song.category + '}\n';
    if (song.youtube) out += '{youtube: ' + song.youtube + '}\n';
    out += '\n';
    out += (song.body || '').trim() + '\n';
    return out;
  }

  function exportSongAsTxt(song) {
    const content = songToChordPro(song);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const safeName = (song.title || 'cancion').replace(/[\\/:*?"<>|]/g, '_');
    downloadBlob(blob, safeName + '.txt');
  }

  function exportAllAsTxt() {
    const songs = getAll();
    if (songs.length === 0) {
      alert('No hay canciones para exportar');
      return;
    }
    let i = 0;
    function next() {
      if (i >= songs.length) {
        alert('Se exportaron ' + songs.length + ' canciones');
        return;
      }
      exportSongAsTxt(songs[i]);
      i++;
      setTimeout(next, 280);
    }
    next();
  }

  function importTxtFiles(fileList) {
    return new Promise(function (resolve) {
      const files = Array.prototype.slice.call(fileList);
      if (files.length === 0) {
        resolve(0);
        return;
      }

      let processed = 0;
      let added = 0;

      files.forEach(function (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const parsed = parseChordProText(e.target.result, file.name);
            if (parsed.title) {
              const exists = getAll().some(function (s) {
                return s.title.toLowerCase() === parsed.title.toLowerCase() &&
                  (s.artist || '').toLowerCase() === (parsed.artist || '').toLowerCase();
              });
              if (!exists) {
                add(parsed);
                added++;
              }
            }
          } catch (err) { }
          processed++;
          if (processed === files.length) resolve(added);
        };
        reader.onerror = function () {
          processed++;
          if (processed === files.length) resolve(added);
        };
        reader.readAsText(file);
      });
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  return {
    getAll: getAll,
    add: add,
    update: update,
    remove: remove,
    updateNotes: updateNotes,
    loadDefaultSongs: loadDefaultSongs,
    exportJSON: exportJSON,
    importJSON: importJSON,
    exportSongAsTxt: exportSongAsTxt,
    exportAllAsTxt: exportAllAsTxt,
    importTxtFiles: importTxtFiles
  };
})();