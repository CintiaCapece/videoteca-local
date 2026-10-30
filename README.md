# Videoteca Local

Un catálogo privado para encontrar y organizar videos guardados en tu computadora, discos externos o un NAS. Los originales se abren para lectura: la aplicación no mueve, renombra ni borra videos.

**[Presentación y demo](https://cintiacapece.github.io/videoteca-local/)** · **[Descargar aplicación](https://cintiacapece.github.io/videoteca-local/downloads/VideotecaLocal.zip)** · **[Guía completa](LEEME.md)**


## Arquitectura y estabilización

Consultá [ARQUITECTURA.md](ARQUITECTURA.md) para el diseño propuesto, los módulos, la recuperación de trabajos, los respaldos y los criterios verificables de una versión estable. La aplicación local es la prioridad; el documento distingue el estado actual de las mejoras por implementar.


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

GitHub Pages aloja sólo `docs/`: presentación, demo interactiva de datos inventados y un ZIP con el código de la aplicación. El catálogo de ejemplo no consulta la computadora ni se conecta al servidor local. Sus cambios duran hasta recargar la página. La demo adicional de transcripción y minuta procesa el archivo o texto elegido en el navegador.

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


## Minutas basadas en el contenido de la reunión

1. Marcá los videos y elegí Transcribir → Preciso (Whisper medium). Se puede volver a transcribir un video; el resultado anterior sólo se reemplaza si finaliza correctamente. Mayor capacidad usa large-v3 en CPU y requiere otra descarga; puede ser mucho más lento.
2. Abrí el video y revisá la transcripción. Los tramos dudosos se señalan con una heurística, que no detecta todos los errores. Podés corregir el texto; una corrección invalida la minuta previa.
3. Marcá el video y elegí Generar minuta. Elegí Qwen3 4B para texto y el modelo visual para buscar etiquetas de nombres. La lectura de pantalla toma entre 6 y 24 muestras; puede omitir nombres breves o leerlos mal.
4. El borrador muestra temas, decisiones explícitas, acciones, pendientes y nombres con citas y botones para abrir el momento del video. Se puede exportar a Markdown. Un nombre mencionado no confirma asistencia. Los nombres visibles y mencionados se distinguen; esta versión no identifica voces ni vincula automáticamente cada frase con una persona.

Ejecutá Configurar-minutas.cmd si faltan Qwen3 4B y Whisper medium. Descarga varios GB y no procesa videos. No hay garantía de transcripción literal exacta ni de una minuta exhaustiva. Las citas se comprueban como coincidencias de texto; esa comprobación no garantiza que el resumen interprete correctamente el contexto. La transcripción y la lectura visual pueden contener errores. El texto del video se trata como datos, no como instrucciones.

El esquema del catálogo se amplía automáticamente al iniciar. Las minutas y el detalle de transcripción se incluyen en la exportación JSON. La aplicación no sube los videos ni el audio a servicios externos.


## Demo gratuita en el navegador

[Transcripción y minuta sin instalar](https://cintiacapece.github.io/videoteca-local/ia.html). Seleccioná un archivo de hasta 5 minutos y 100 MB o pegá una transcripción de hasta 12.000 caracteres. Revisá el texto antes de preparar la minuta. Incluye ejemplo ficticio, progreso por fragmentos, tiempo transcurrido, cancelación, descarga TXT y minuta Markdown.

**Modo rápido, predeterminado:** no descarga un modelo de texto. Usa reglas para seleccionar frases literales con expresiones explícitas de acuerdos, tareas y pendientes. La vista previa son las primeras frases de cada fragmento, no una identificación semántica de los temas importantes ni una síntesis narrativa. Los nombres se toman de etiquetas de hablante escritas como `Ana:`; no hay identificación de voces ni lectura de nombres en pantalla. Las reglas pueden omitir información o clasificar mal. Un nombre mencionado no confirma asistencia.

**IA de texto experimental:** descarga Qwen2.5 Instruct 0.5B para proponer citas de temas y nombres; los acuerdos, tareas y pendientes siguen usando reglas explícitas. Se comprueban las referencias a frases existentes y los nombres literales, pero esto no verifica la interpretación. En las pruebas, el modelo compacto clasificó mal varias frases. No debe usarse como minuta fiable sin revisión. Se descartó el modelo de 1.5B como opción pública porque falló al ejecutarse en el navegador de prueba, tanto en q4 como en la prueba de menor memoria.

El audio usa Whisper base q8 en CPU por tramos de 25 segundos; puede contener errores y cortes de palabras en los límites. El motor es Transformers.js 3.8.1 dentro de un Web Worker. La IA de texto intenta WebGPU (q4f16 si admite shader-f16) con alternativa WASM/q4; se puede elegir CPU explícitamente. Chrome/Edge de escritorio recomendados. La GPU, memoria, navegador y códecs pueden limitar su funcionamiento. La primera descarga de los modelos requiere varios cientos de MB y puede tardar minutos. Los porcentajes de descarga son por componente y los de procesamiento avanzan por fragmento; no estiman tiempo restante.

Los modelos se descargan desde Hugging Face y el motor/WASM desde jsDelivr al solicitar una tarea. Esos servicios reciben solicitudes de descarga; la aplicación no envía archivos ni transcripciones a un servidor de IA. Los modelos pueden quedar en la caché. No se guarda historial de contenido: Limpiar termina el worker y borra los resultados de la página, pero no la caché de modelos. Recargar pierde los resultados. Exportá para conservarlos.

YouTube no se descarga automáticamente: se puede copiar una transcripción disponible o seleccionar un archivo que el visitante pueda procesar. No se requieren cuenta, claves, instalaciones, servicios pagos ni Hugging Face Spaces. GitHub Pages sirve los archivos estáticos.

Pruebas de límites, fragmentación, referencias, nombres y reglas: `node --test test/browser-demo.test.mjs`. Se probó en navegador una transcripción de voz sintética (con errores de reconocimiento), la minuta rápida con datos ficticios, la validación de entrada vacía, la cancelación y la descarga Markdown. Esto no garantiza calidad con grabaciones reales. Referencias: [Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/index), [Whisper base ONNX](https://huggingface.co/Xenova/whisper-base), [Qwen2.5 ONNX](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct).
