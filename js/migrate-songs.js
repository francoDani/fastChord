const OfficialSongsMigration = (function () {
  const sectionPattern = /^(Verse|Chorus|Bridge|Intro|Outro|Solo|Pre-Chorus|Prechorus|Interlude|Tag|Ending|Instrumental|Coda|Refrain)(\s+\d+)?\s*$/i;

  function parseSong(text, sourceFile) {
    const lines = text.split(/\r?\n/);
    const title = getMetadata(lines, 'title');
    const artist = getMetadata(lines, 'artist');
    const category = getMetadata(lines, 'category');
    const body = lines.slice(3).map(function (line) {
      return sectionPattern.test(line.trim()) ? '§SECTION§' + line.trim() : line;
    }).join('\n').trim();

    return {
      source_file: sourceFile,
      title: title,
      artist: artist,
      category: category,
      body: body,
      is_official: true,
      deleted_at: null
    };
  }

  function getMetadata(lines, key) {
    const prefix = '{' + key + ':';
    const line = lines.find(function (item) {
      return item.trim().toLowerCase().indexOf(prefix) === 0;
    });
    if (!line) return '';
    return line.replace(/^\{[^:]+:\s*(.*?)\}\s*$/i, '$1').trim();
  }

  async function run() {
    const sessionResult = await SupabaseClient.auth.getSession();
    const session = sessionResult.data.session;
    if (!session) throw new Error('Debes iniciar sesión antes de migrar las canciones.');

    const profileResult = await SupabaseClient
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (profileResult.error) throw profileResult.error;
    if (profileResult.data.role !== 'admin') {
      throw new Error('Solo un administrador puede ejecutar la migración oficial.');
    }

    const manifestResponse = await fetch('data/manifest.json');
    if (!manifestResponse.ok) throw new Error('No se pudo cargar el manifest.');
    const files = await manifestResponse.json();
    const songs = await Promise.all(files.map(async function (sourceFile) {
      const response = await fetch('data/songs/' + sourceFile);
      if (!response.ok) throw new Error('No se pudo cargar ' + sourceFile);
      return parseSong(await response.text(), sourceFile);
    }));

    const result = await SupabaseClient
      .from('songs')
      .upsert(songs, { onConflict: 'source_file' });
    if (result.error) throw result.error;
    return songs.length;
  }

  return { run: run };
})();

window.migrateOfficialSongs = function () {
  return OfficialSongsMigration.run();
};
