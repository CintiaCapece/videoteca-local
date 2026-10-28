# Videoteca Local

Un catálogo privado para encontrar y organizar videos guardados en tu computadora, discos externos o un NAS. Los originales se abren para lectura: la aplicación no mueve, renombra ni borra videos.

**[Presentación y demo](https://cintiacapece.github.io/videoteca-local/)** · **[Descargar aplicación](https://cintiacapece.github.io/videoteca-local/downloads/VideotecaLocal.zip)** · **[Guía completa](LEEME.md)**

## Empezar en Windows

1. Descargá y extraé el ZIP.
2. Instalá [Node.js 24 LTS o posterior](https://nodejs.org/), si no está disponible.
3. Abrí `Iniciar.cmd` y mantené su ventana abierta.
4. En el navegador, elegí **Agregar carpeta**. La dirección local predeterminada es `http://127.0.0.1:43127`.

El inventario, las etiquetas, la búsqueda textual, los duplicados SHA-256 y las exportaciones funcionan sin dependencias npm. FFmpeg habilita miniaturas y metadatos; Ollama, la IA visual; Python y faster-whisper, la transcripción opcional. Consultá [LEEME.md](LEEME.md).

Para configurar esas herramientas, abrí **Configurar-herramientas.cmd**. Descarga los componentes, instala el audio para CPU y ejecuta una prueba con video y voz sintéticos. Requiere internet y al menos 15 GB libres. Consultá la guía para ver ubicaciones, límites y alternativas manuales.

## Qué incluye

- Catálogo persistente SQLite, filtros y edición de categorías, etiquetas y notas.
- Fuentes independientes para carpetas locales, discos externos y rutas SMB.
- Miniaturas y metadatos con FFmpeg/ffprobe.
- Duplicados exactos con SHA-256 y verificación de archivos modificados.
- Análisis visual local opcional: cinco fotogramas por video con evidencia temporal.
- Transcripción multilingüe opcional con faster-whisper small, CPU por defecto.
- Cola secuencial con pausa y reanudación, registro de incidencias y exportación JSON/CSV.

## Sitio público y aplicación local

GitHub Pages aloja sólo `docs/`: presentación, demo interactiva de datos inventados y un ZIP con el código de la aplicación. La demo no consulta la computadora, no se conecta al servidor local y no ejecuta IA. Los cambios de la demo duran hasta recargar la página.

La aplicación completa se ejecuta en la computadora del usuario. Las bases de datos, miniaturas, modelos y bibliotecas personales no se incluyen en este repositorio. Para respaldar el catálogo, cerrá la aplicación y copiá su carpeta `datos` completa. Mantené esa carpeta en almacenamiento local, incluso si los videos están en un NAS.

## Desarrollo y pruebas

```text
node server.js
node --test test/*.test.js
```

Requiere Node.js 24 o posterior. Las pruebas usan carpetas temporales y cubren inventario, pausas, reanudación, duplicados, cambios de contenido, fuentes desconectadas, HTTP, exportación y protección de escrituras. La ejecución real de FFmpeg, Ollama y faster-whisper requiere instalar esas dependencias y validar con material propio.

## Publicación con GitHub Pages

En **Settings → Pages**, elegí **Deploy from a branch**, rama **main**, carpeta **/docs**, y guardá. No se necesita compilación. Los recursos usan rutas relativas para funcionar bajo `/videoteca-local/`.

El ZIP público contiene sólo una lista explícita de archivos de la aplicación; no incluye `datos`, modelos, entornos ni archivos personales. Para actualizarlo, usá `Empaquetar.ps1` antes de publicar una nueva versión.

## Límites actuales

La búsqueda es textual; no hay búsqueda semántica ni detección de recortes o videos recomprimidos. La organización es mediante el catálogo; no hay reorganización física automática. Las descripciones visuales son parciales y deben revisarse. La reproducción depende de los códecs del navegador. Consultá la guía para más detalles.
