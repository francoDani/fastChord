---
name: chordpro-converter
description: >-
  Analiza y convierte canciones con acordes a formato ChordPro con acordes en inglés (C, D, E, F, G, A, B).
  Detecta automáticamente si la notación original está en español (Do, Re, Mi, Fa, Sol, La, Si) o en inglés,
  traduce los acordes manteniendo la alineación y los corchetes [Acorde], estructura las secciones con directivas
  {comment: Verse 1}, {comment: Chorus}, etc., y limpia caracteres ocultos o errores de codificación.
  Usar siempre que el usuario solicite convertir canciones a ChordPro o pasar acordes a notación americana/inglesa.
---

# ChordPro Converter Skill

Esta skill proporciona los procedimientos, reglas y herramientas para transformar letras de canciones con acordes (en formato tradicional con acordes sobre la letra) al formato **ChordPro**, con notas en cifrado anglosajón / inglés (`C`, `D`, `E`, `F`, `G`, `A`, `B`).

---

## 1. Detección Automática de Notación

Antes de transformar, analizar el texto para determinar si los acordes están en notación latina/española o anglosajona/inglesa:

| Sistema | Notas Raíz | Ejemplos |
| :--- | :--- | :--- |
| **Español (Latino)** | `DO`, `RE`, `MI`, `FA`, `SOL`, `LA`, `SI` | `RE`, `SIm`, `SOL`, `FA#m`, `RE7`, `DOmaj7`, `LAm/SOL` |
| **Inglés (Anglosajón)** | `C`, `D`, `E`, `F`, `G`, `A`, `B` | `D`, `Bm`, `G`, `F#m`, `D7`, `Cmaj7`, `Am/G` |

### Reglas de desambiguación:
- Palabras en español como *"la"*, *"mi"*, *"si"*, *"do"* o la letra inglesa *"A"* dentro de oraciones con letra regular no deben confundirse con acordes.
- Una **línea de acordes** se reconoce porque:
  1. Está compuesta predominantemente por acordes y espacios en blanco (> 60% de tokens musicales).
  2. Los acordes están separados por varios espacios alineados sobre palabras específicas.
  3. Precede directamente a una línea de letra.

---

## 2. Tabla de Conversión de Acordes

Reemplazar cada nota raíz latina por su equivalente en inglés conservando alteraciones, sufijos y bajos:

| Español | Inglés |
| :---: | :---: |
| `DO` / `Do` | `C` |
| `RE` / `Re` | `D` |
| `MI` / `Mi` | `E` |
| `FA` / `Fa` | `F` |
| `SOL` / `Sol` | `G` |
| `LA` / `La` | `A` |
| `SI` / `Si` | `B` |

### Conservación de Cualidades y Alteraciones:
- **Alteraciones**: `#` (sostenido), `b` (bemol).
- **Cualidades**: `m` (menor), `maj7`, `7`, `sus2`, `sus4`, `dim`, `aug`, `add9`, etc.
- **Bajos invertidos**: `/SOL` $\to$ `/G`, `/FA#` $\to$ `/F#`, `/DO` $\to$ `/C`.

*Ejemplos:*
- `RE` $\to$ `[D]`
- `SIm` $\to$ `[Bm]`
- `FA#m` $\to$ `[F#m]`
- `SOL7` $\to$ `[G7]`
- `LAm/SOL` $\to$ `[Am/G]`

---

## 3. Formato ChordPro Objetivo

El formato final debe presentar cada sección etiquetada y los acordes entre corchetes `[...]` en su propia línea sobre la letra, preservando la posición horizontal de las columnas:

```chordpro
{comment: Verse 1}
[Em]                        [Bm]
Contaron lo que les había pasado en el camino.
[Em]                        [Bm]
Contaron lo que les había pasado en el camino.
[G]                [D]
Y como lo habían reconocido
```

### Encabezados de Sección Estandarizados:
- Estrofas / Versos: `{comment: Verse 1}`, `{comment: Verse 2}`, `{comment: Verse 3}`...
- Coro / Estribillo: `{comment: Chorus}`
- Puente: `{comment: Bridge}`
- Introducción: `{comment: Intro}`
- Final / Coda: `{comment: Outro}`

---

## 4. Limpieza de Texto y Codificación

Antes de procesar, limpiar caracteres corruptos comunes:
1. Eliminar **guiones blandos** invisibles (`\u00ad` o `soft hyphen`) que rompen palabras como `Aquí­` o `alegrí­a`.
2. Eliminar **espacios de ancho cero** (`\u200b`) y marcas de orden de bytes (`\ufeff`).
3. Corregir caracteres UTF-8 mal codificados (`Ã¡` $\to$ `á`, `Ã©` $\to$ `é`, `Ã­` $\to$ `í`, `Ã±` $\to$ `ñ`, etc.).

---

## 5. Script Automatizado

Se incluye un script ejecutable en Node.js para realizar la conversión de manera instantánea y automatizada:

- **Ruta del script**: [convert.js](./scripts/convert.js)

### Modos de Uso:

1. **Sobrescribir archivo en el lugar (`--in-place`):**
   ```powershell
   node .agents/skills/chordpro-converter/scripts/convert.js F:\Franco\code\cancion.txt -i
   ```

2. **Crear nuevo archivo convertido:**
   ```powershell
   node .agents/skills/chordpro-converter/scripts/convert.js F:\Franco\code\cancion.txt -o F:\Franco\code\cancion_chordpro.txt
   ```

3. **Ver resultado en consola:**
   ```powershell
   node .agents/skills/chordpro-converter/scripts/convert.js F:\Franco\code\cancion.txt
   ```

---

## 6. Procedimiento para el Asistente

Cuando el usuario pida convertir una o más canciones:
1. Leer el archivo o texto proporcionado.
2. Identificar si está en notación en español o inglés y detectar las secciones (estrofas, coros, etc.).
3. Ejecutar el script `convert.js` o aplicar las reglas descritas directamente con `replace_file_content` o `write_to_file`.
4. Verificar que las estrofas repetidas mantengan los acordes correspondientes y que la alineación de corchetes `[Acorde]` coincida con la métrica y las sílabas de la letra.
