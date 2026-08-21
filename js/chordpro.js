const ChordPro = (function () {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_TO_SHARP = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'db': 'C#', 'eb': 'D#', 'gb': 'F#', 'ab': 'G#', 'bb': 'A#'
  };

  function normalizeNote(note) {
    if (!note) return note;
    const clean = note.replace(/\/.*/, '');
    return FLAT_TO_SHARP[clean] || clean;
  }

  function transposeChord(chord, semitones) {
    if (!chord || !chord.trim()) return chord;

    const match = chord.match(/^([A-Ga-g][#b]?)([^/]*)(\/[A-Ga-g][#b]?)?$/);
    if (!match) return chord;

    let root = match[1];
    const quality = match[2] || '';
    let bass = match[3] || '';

    root = root.charAt(0).toUpperCase() + root.slice(1);
    root = normalizeNote(root);

    let idx = NOTES.indexOf(root);
    if (idx === -1) return chord;

    idx = (idx + semitones + 120) % 12;
    let newRoot = NOTES[idx];

    if (bass) {
      let bassNote = bass.substring(1);
      bassNote = bassNote.charAt(0).toUpperCase() + bassNote.slice(1);
      bassNote = normalizeNote(bassNote);
      let bIdx = NOTES.indexOf(bassNote);
      if (bIdx !== -1) {
        bIdx = (bIdx + semitones + 120) % 12;
        bass = '/' + NOTES[bIdx];
      }
    }

    return newRoot + quality + bass;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(text, transpose) {
    transpose = transpose || 0;
    if (!text) return '';

    const lines = text.split(/\r?\n/);
    let html = '';

    lines.forEach(function (rawLine) {
      const line = rawLine.trim();

      // Encabezado de sección
      if (line.indexOf('§SECTION§') === 0) {
        const sectionName = line.replace('§SECTION§', '').trim();
        html += '<div class="section-header">' + escapeHtml(sectionName) + '</div>';
        return;
      }

      // Compatibilidad con el formato anterior {comment: Verse 1}
      const commentMatch = line.match(/^\{comment\s*:\s*(.+?)\}\s*$/i);
      if (commentMatch) {
        html += '<div class="section-header">' + escapeHtml(commentMatch[1].trim()) + '</div>';
        return;
      }

      const chordRegex = /\[([^\]]+)\]/g;
      let match;
      const chords = [];
      let cleaned = '';
      let lastIndex = 0;

      while ((match = chordRegex.exec(rawLine)) !== null) {
        cleaned += rawLine.slice(lastIndex, match.index);
        const chordText = transposeChord(match[1], transpose);
        chords.push({
          chord: chordText,
          position: cleaned.length
        });
        lastIndex = match.index + match[0].length;
      }
      cleaned += rawLine.slice(lastIndex);

      if (chords.length === 0) {
        html += '<div class="chord-line"><div class="lyrics">' + escapeHtml(cleaned) + '</div></div>';
        return;
      }

      let chordLine = '';
      let currentPos = 0;

      chords.forEach(function (c) {
        const spacesNeeded = Math.max(0, c.position - currentPos);
        chordLine += new Array(spacesNeeded + 1).join(' ') + c.chord;
        currentPos = c.position + c.chord.length;
      });

      html += '<div class="chord-line">' +
        '<div class="chords">' + escapeHtml(chordLine) + '</div>' +
        '<div class="lyrics">' + escapeHtml(cleaned) + '</div>' +
        '</div>';
    });

    return html;
  }

  return {
    render: render,
    transposeChord: transposeChord
  };
})();