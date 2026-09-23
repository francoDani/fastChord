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

  const SECTION_KEYWORDS_REGEX = /^(Estrofa|Verso|Verse|Chorus|Coro|Bridge|Puente|Intro|Outro|Solo|Pre-Chorus|Pre-Coro|Prechorus|Precoro|Interlude|Interludio|Tag|Ending|Final|Instrumental|Coda|Refrain)(\s+.*)?$/i;

  function isSectionHeaderLine(line) {
    if (!line) return false;
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.indexOf('§SECTION§') === 0) return true;
    if (/^\{(?:comment|c|comment_italic|ci|comment_box|cb|subtitle|st)\s*:/i.test(trimmed)) return true;
    if (/^\{(?:start_of_chorus|soc|end_of_chorus|eoc|start_of_verse|sov|end_of_verse|eov)\}\s*$/i.test(trimmed)) return true;
    if (/^\{(?:title|t|artist|category|key|tempo|time|capo|youtube)\s*:/i.test(trimmed)) return true;
    if (SECTION_KEYWORDS_REGEX.test(trimmed)) return true;
    const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (bracketMatch && SECTION_KEYWORDS_REGEX.test(bracketMatch[1].trim())) return true;
    return false;
  }

  function render(text, transpose) {
    transpose = transpose || 0;
    if (!text) return '';

    const lines = text.split(/\r?\n/);
    let html = '';

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex];
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      // Encabezado de sección
      if (line.indexOf('§SECTION§') === 0) {
        const sectionName = line.replace('§SECTION§', '').trim();
        html += '<div class="section-header">' + escapeHtml(sectionName) + '</div>';
        continue;
      }

      // Directivas {comment: ...}, {c: ...}, {subtitle: ...}, {st: ...}, etc.
      const commentMatch = line.match(/^\{(?:comment|c|comment_italic|ci|comment_box|cb|subtitle|st)\s*:\s*(.+?)\}\s*$/i);
      if (commentMatch) {
        html += '<div class="section-header">' + escapeHtml(commentMatch[1].trim()) + '</div>';
        continue;
      }

      // Directivas de bloque {soc}, {start_of_chorus}, {sov}, {start_of_verse}
      if (/^\{(?:start_of_chorus|soc)\}\s*$/i.test(line)) {
        html += '<div class="section-header">CORO</div>';
        continue;
      }
      if (/^\{(?:end_of_chorus|eoc|end_of_verse|eov)\}\s*$/i.test(line)) {
        continue;
      }
      if (/^\{(?:start_of_verse|sov)\}\s*$/i.test(line)) {
        html += '<div class="section-header">ESTROFA</div>';
        continue;
      }

      // Ignorar directivas de metadatos en el cuerpo si las hay
      if (/^\{(?:title|t|artist|category|key|tempo|time|capo|youtube)\s*:/i.test(line)) {
        continue;
      }

      // Encabezados entre corchetes como [Estrofa 1], [Coro], [Verse 2], [Puente]
      const bracketSectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (bracketSectionMatch && SECTION_KEYWORDS_REGEX.test(bracketSectionMatch[1].trim())) {
        html += '<div class="section-header">' + escapeHtml(bracketSectionMatch[1].trim()) + '</div>';
        continue;
      }

      // Nombre de sección en texto plano como "Estrofa 1", "Coro", "Verse 2", "Puente"
      if (SECTION_KEYWORDS_REGEX.test(line)) {
        html += '<div class="section-header">' + escapeHtml(line) + '</div>';
        continue;
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
        continue;
      }

      let chordLine = '';
      let currentPos = 0;

      chords.forEach(function (c) {
        const spacesNeeded = Math.max(0, c.position - currentPos);
        chordLine += new Array(spacesNeeded + 1).join(' ') + c.chord;
        currentPos = c.position + c.chord.length;
      });

      const lyricsHtml = cleaned.trim()
        ? '<div class="lyrics">' + escapeHtml(cleaned) + '</div>'
        : getFollowingLyrics(lines, lineIndex);

      if (!cleaned.trim() && lyricsHtml) lineIndex++;

      html += '<div class="chord-line">' +
        '<div class="chords">' + escapeHtml(chordLine) + '</div>' +
        lyricsHtml +
        '</div>';
    }

    return html;
  }

  function getFollowingLyrics(lines, lineIndex) {
    const nextLine = lines[lineIndex + 1];
    if (!nextLine) return '';
    if (isSectionHeaderLine(nextLine)) return '';
    const nextTrimmed = nextLine.trim();
    if (!nextTrimmed || /\[[^\]]+\]/.test(nextLine)) return '';
    return '<div class="lyrics">' + escapeHtml(nextLine) + '</div>';
  }

  return {
    render: render,
    transposeChord: transposeChord
  };
})();