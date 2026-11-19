#!/usr/bin/env node

/**
 * ChordPro Converter Script
 *
 * Detects whether chord notation is in Spanish (Do, Re, Mi, Fa, Sol, La, Si)
 * or English (C, D, E, F, G, A, B), converts chords to English, and formats
 * songs into ChordPro format with section comments ({comment: Verse 1}, etc.)
 * and bracketed chords ([D], [Bm]) aligned above lyric lines.
 */

const fs = require('fs');
const path = require('path');

const SPANISH_ROOTS = {
  'DO': 'C', 'RE': 'D', 'MI': 'E', 'FA': 'F', 'SOL': 'G', 'LA': 'A', 'SI': 'B',
  'Do': 'C', 'Re': 'D', 'Mi': 'E', 'Fa': 'F', 'Sol': 'G', 'La': 'A', 'Si': 'B',
  'do': 'C', 're': 'D', 'mi': 'E', 'fa': 'F', 'sol': 'G', 'la': 'A', 'si': 'B'
};

const SPANISH_CHORD_REGEX = /\b(DO|RE|MI|FA|SOL|LA|SI)(#|b)?(m|min|maj|maj7|M7|M|dim|aug|sus2|sus4|sus|add9|[2-9]|11|13|\+|º|°)?(?:\/(DO|RE|MI|FA|SOL|LA|SI)(#|b)?)?\b/gi;
const ENGLISH_CHORD_REGEX = /\b([A-G])(#|b)?(m|min|maj|maj7|M7|M|dim|aug|sus2|sus4|sus|add9|[2-9]|11|13|\+|º|°)?(?:\/([A-G])(#|b)?)?\b/g;

function cleanEncoding(text) {
  return text
    .replace(/\u00ad/g, '') // remove soft hyphens
    .replace(/\u200b/g, '') // remove zero-width space
    .replace(/\ufeff/g, '') // remove BOM
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ');
}

function isChordToken(token, isSpanish) {
  if (!token) return false;
  const clean = token.replace(/^[(\[]+|[)\].,;]+$/g, '');
  if (!clean) return false;

  if (isSpanish) {
    SPANISH_CHORD_REGEX.lastIndex = 0;
    const m = SPANISH_CHORD_REGEX.exec(clean);
    return m !== null && m[0] === clean;
  } else {
    ENGLISH_CHORD_REGEX.lastIndex = 0;
    const m = ENGLISH_CHORD_REGEX.exec(clean);
    return m !== null && m[0] === clean;
  }
}

function analyzeSongNotation(lines) {
  let spanishScore = 0;
  let englishScore = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^\{.*\}$/.test(trimmed)) continue;

    const tokens = trimmed.split(/\s+/);
    for (const token of tokens) {
      if (isChordToken(token, true)) {
        const upper = token.toUpperCase();
        if ((upper === 'LA' || upper === 'MI' || upper === 'SI' || upper === 'DO') && tokens.length > 3) {
          // Might be lyrics in a full sentence
        } else {
          spanishScore++;
        }
      } else if (isChordToken(token, false)) {
        const upper = token.toUpperCase();
        if (upper === 'A' && tokens.length > 3) {
          // Might be article 'A'
        } else {
          englishScore++;
        }
      }
    }
  }

  return {
    notation: spanishScore >= englishScore ? 'spanish' : 'english',
    spanishScore,
    englishScore
  };
}

function isChordLine(line, isSpanish) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\{.*\}$/.test(trimmed)) return false;
  if (/^\[[^\]]+\](\s+\[[^\]]+\])*$/.test(trimmed)) return true; // Already bracketed chords

  const tokens = trimmed.split(/\s+/);
  let chordCount = 0;
  let wordCount = 0;

  for (const token of tokens) {
    if (isChordToken(token, isSpanish)) {
      chordCount++;
    } else {
      wordCount++;
    }
  }

  if (chordCount === 0) return false;
  if (wordCount === 0) return true;
  return (chordCount / (chordCount + wordCount)) >= 0.6;
}

function translateChord(chord) {
  SPANISH_CHORD_REGEX.lastIndex = 0;
  return chord.replace(SPANISH_CHORD_REGEX, (match, root, accidental, quality, bassRoot, bassAccidental) => {
    const enRoot = SPANISH_ROOTS[root] || root.toUpperCase();
    const acc = accidental || '';
    const q = quality || '';
    let bass = '';
    if (bassRoot) {
      const enBassRoot = SPANISH_ROOTS[bassRoot] || bassRoot.toUpperCase();
      const bAcc = bassAccidental || '';
      bass = '/' + enBassRoot + bAcc;
    }
    return enRoot + acc + q + bass;
  });
}

function formatChordLine(rawLine, isSpanish) {
  if (/\[[^\]]+\]/.test(rawLine)) {
    return rawLine.replace(/\[([^\]]+)\]/g, (match, chord) => {
      const trans = isSpanish ? translateChord(chord) : chord;
      return '[' + trans + ']';
    });
  }

  const regex = isSpanish
    ? new RegExp(SPANISH_CHORD_REGEX.source, 'gi')
    : new RegExp(ENGLISH_CHORD_REGEX.source, 'g');

  let match;
  const chords = [];
  while ((match = regex.exec(rawLine)) !== null) {
    chords.push({
      chord: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  if (chords.length === 0) return rawLine;

  let result = '';
  let lastPos = 0;

  for (const c of chords) {
    const spaces = Math.max(0, c.start - lastPos);
    result += ' '.repeat(spaces);
    const trans = isSpanish ? translateChord(c.chord) : c.chord;
    result += '[' + trans + ']';
    lastPos = c.start + trans.length;
  }

  return result;
}

function normalizeSectionHeader(line) {
  const trimmed = line.trim();
  const commentMatch = trimmed.match(/^\{(?:comment|c)\s*:\s*(.+?)\}\s*$/i);
  if (commentMatch) {
    return `{comment: ${commentMatch[1].trim()}}`;
  }

  const sectionRegex = /^\[?(estrofa|verso|verse|coro|chorus|puente|bridge|intro|outro|final|interludio|interlude|coda|tag|pre-coro|pre-chorus)(?:\s+(\d+|[a-zA-Z]+))?\]?\s*[:.]?$/i;
  const match = trimmed.match(sectionRegex);
  if (match) {
    let type = match[1].toLowerCase();
    const num = match[2] ? ' ' + match[2] : '';

    if (type === 'estrofa' || type === 'verso') type = 'Verse';
    else if (type === 'coro') type = 'Chorus';
    else if (type === 'puente') type = 'Bridge';
    else if (type === 'final') type = 'Outro';
    else if (type === 'interludio') type = 'Interlude';
    else if (type === 'pre-coro') type = 'Pre-Chorus';
    else {
      type = type.charAt(0).toUpperCase() + type.slice(1);
    }

    return `{comment: ${type}${num}}`;
  }

  return null;
}

function convertSong(content) {
  const cleaned = cleanEncoding(content);
  const rawLines = cleaned.split(/\r?\n/);
  const analysis = analyzeSongNotation(rawLines);
  const isSpanish = analysis.notation === 'spanish';

  // Split into stanzas (blocks separated by empty lines)
  const stanzas = [];
  let currentStanza = [];

  for (const line of rawLines) {
    if (!line.trim()) {
      if (currentStanza.length > 0) {
        stanzas.push(currentStanza);
        currentStanza = [];
      }
    } else {
      currentStanza.push(line);
    }
  }
  if (currentStanza.length > 0) {
    stanzas.push(currentStanza);
  }

  // Detect recurring stanzas (Chorus)
  const lyricsSignatures = stanzas.map(stanza => {
    return stanza
      .map(l => l.trim())
      .filter(l => l && !isChordLine(l, isSpanish) && !normalizeSectionHeader(l))
      .join(' ')
      .toLowerCase();
  });

  const sigCounts = {};
  lyricsSignatures.forEach(sig => {
    if (sig) sigCounts[sig] = (sigCounts[sig] || 0) + 1;
  });

  let verseCount = 0;
  const processedStanzas = [];

  for (let sIdx = 0; sIdx < stanzas.length; sIdx++) {
    const stanza = stanzas[sIdx];
    const firstLine = stanza[0].trim();
    const existingHeader = normalizeSectionHeader(firstLine);

    let header = existingHeader;
    let linesToProcess = stanza;

    if (existingHeader) {
      linesToProcess = stanza.slice(1);
    } else {
      const sig = lyricsSignatures[sIdx];
      if (sig && sigCounts[sig] > 1) {
        header = '{comment: Chorus}';
      } else {
        verseCount++;
        header = `{comment: Verse ${verseCount}}`;
      }
    }

    const processedLines = [];
    if (header) {
      processedLines.push(header);
    }

    for (const line of linesToProcess) {
      if (isChordLine(line, isSpanish)) {
        processedLines.push(formatChordLine(line, isSpanish));
      } else {
        processedLines.push(line);
      }
    }

    processedStanzas.push(processedLines.join('\n'));
  }

  return {
    analysis,
    result: processedStanzas.join('\n\n')
  };
}

// CLI handler
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: node convert.js <input-file> [options]

Options:
  -i, --in-place       Overwrite the input file directly
  -o, --output <file>  Specify an output file path
  -h, --help           Show this help message

Example:
  node convert.js F:\\Franco\\code\\cancion.txt -i
`);
    process.exit(0);
  }

  const inputFile = args[0];
  const inPlace = args.includes('-i') || args.includes('--in-place');
  let outputFile = null;
  const outIdx = args.indexOf('-o') !== -1 ? args.indexOf('-o') : args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outputFile = args[outIdx + 1];
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  const { analysis, result } = convertSong(raw);

  console.log(`[info] Detected notation: ${analysis.notation.toUpperCase()} (Spanish score: ${analysis.spanishScore}, English score: ${analysis.englishScore})`);

  if (inPlace) {
    fs.writeFileSync(inputFile, result, 'utf8');
    console.log(`[ok] Updated in-place: ${inputFile}`);
  } else if (outputFile) {
    fs.writeFileSync(outputFile, result, 'utf8');
    console.log(`[ok] Saved output to: ${outputFile}`);
  } else {
    console.log('\n--- Converted ChordPro Output ---\n');
    console.log(result);
  }
}

module.exports = {
  convertSong,
  analyzeSongNotation,
  translateChord,
  formatChordLine,
  cleanEncoding
};
