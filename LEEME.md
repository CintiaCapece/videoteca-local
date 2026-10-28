# Videoteca Local

Aplicación local para Windows 11. Diseñada para empezar en una Dell Precision 5560 con 32 GB de RAM y RTX A2000 de 4 GB y ampliar el catálogo a discos externos o NAS.

## Abrir

1. Abrí **Iniciar.cmd** con doble clic. Se abrirá el navegador en http://127.0.0.1:43127.
2. Conservá abierta la ventana de inicio. Para cerrar el servidor, presioná Ctrl+C en esa ventana.
3. Elegí **Agregar carpeta**, escribí un nombre y la ruta completa de una carpeta con videos. No elijas todo C: para el primer piloto.
4. Se inicia el inventario. Después usá **Miniaturas y datos** y **Buscar duplicados**.

No necesita paquetes npm ni Python para el catálogo. Usa Node.js 24 o posterior y SQLite incluido. En esta computadora, el iniciador también busca el motor que ya instala Codex. Para independizarlo de Codex o usar otra PC, instalá Node.js 24 LTS desde https://nodejs.org.

La aplicación no inicia el inventario de tus discos por su cuenta. Vos elegís las carpetas.

## Funciones disponibles

- Inventario recursivo de formatos de video comunes; identificación estable por fuente y ruta relativa.
- Base SQLite persistente en `datos/catalogo.sqlite`, con un único servidor escritor.
- Catálogo paginado, búsqueda textual por nombre, etiquetas, notas, descripciones y transcripciones; filtros por categoría y fuente.
- Categorías y etiquetas manuales. Sugerencias de IA separadas de la categoría aprobada.
- Miniaturas y duración/resolución cuando están instalados FFmpeg y ffprobe.
- Duplicados exactos por SHA-256: primero agrupa por tamaño y luego lee el contenido de los candidatos. Nunca elimina archivos.
- Reproducción con búsqueda temporal para formatos compatibles con el navegador; MKV, AVI y ciertos códecs pueden requerir VLC u otro reproductor externo.
- Análisis local con Ollama: cinco muestras por video, evidencia temporal, modelo utilizado y categoría sugerida.
- Transcripción completa opcional con faster-whisper small, CPU por defecto y GPU opcional.
- Trabajos secuenciales, pausa y reanudación. Después de cerrar inesperadamente, los trabajos se muestran como interrumpidos y se pueden reanudar. Los archivos completamente procesados se conservan; un archivo parcial se vuelve a procesar.
- Fuentes desconectadas visibles; actualización de ubicación con verificación de una muestra.
- Exportación completa JSON y CSV compatible con Excel, sin copiar videos.

La selección de fuente limita los trabajos. Las categorías y la búsqueda sólo filtran la vista, no los trabajos. En **Todos los videos**, los trabajos abarcan todas las fuentes. Si un disco está desconectado, sus archivos pendientes registran una incidencia y podrán volver a intentarse.

## Instalar miniaturas y metadatos

### Configuracion automatica recomendada

Abri **Configurar-herramientas.cmd**. Descarga FFmpeg desde Gyan (proveedor enlazado por ffmpeg.org), Ollama desde su repositorio oficial y el modelo Qwen3-VL 2B Instruct Q4. Crea un entorno Python propio e instala faster-whisper para CPU. Puede reutilizar Python de Codex; si no encuentra un Python compatible, indica como instalarlo desde python.org.

Reserva al menos 15 GB libres para descargas, extraccion y modelos. La primera configuracion necesita internet; las descargas pueden tardar bastante. No instala CUDA ni cambia los controladores. No configura servicios de inicio automatico de Windows.

El iniciador abre Ollama portable en segundo plano, limitado a la propia computadora. Si ya hay un servicio Ollama en ese puerto, lo reutiliza; en ese caso el modelo se guarda en la ubicacion configurada por ese servicio. Si lo inicia esta aplicacion, usa `datos/modelos/ollama`. Cerrar Videoteca no detiene Ollama; los modelos visuales se descargan de memoria al terminar cada peticion.

La configuracion genera un video de color verde con voz sintetica, comprueba FFmpeg/ffprobe, solicita una descripcion a Ollama y transcribe la voz. Solo escribe `datos/pruebas` y sus propias herramientas. Al finalizar guarda `datos/pruebas/resultado.json`. Si falla, no declara completada la instalacion y muestra el paso que requiere revision. No inicia ningun inventario de tus videos.

Para comprobar sin descargar ni instalar: `powershell -File .\Configurar-herramientas.ps1 -SoloComprobar`. El indicador `pruebaCompleta` informa si existe un resultado de una prueba anterior; no garantiza el funcionamiento actual.

Despues de configurar, cierra cualquier instancia anterior y abri **Iniciar.cmd**. En **Herramientas y ayuda** deben aparecer FFmpeg, ffprobe, Ollama y Python + faster-whisper disponibles.

### Alternativa manual

FFmpeg y ffprobe no estaban instalados durante la creación. Descargá una compilación para Windows siguiendo los enlaces de https://ffmpeg.org/download.html.

Opción simple: creá una carpeta `herramientas` junto a `Iniciar.cmd` y colocá allí `ffmpeg.exe` y `ffprobe.exe`. También se pueden instalar en PATH. Reiniciá la aplicación y verificá **Herramientas y ayuda**.

Los videos se leen y las miniaturas JPEG se guardan en `datos/miniaturas`. No se convierte ni se copia toda la biblioteca.

## Instalar IA visual opcional

1. Instalá Ollama para Windows desde https://ollama.com/download/windows y mantené su servicio abierto.
2. En PowerShell ejecutá:

```powershell
ollama pull qwen3-vl:2b-instruct-q4_K_M
```

3. Comprobá las herramientas desde la aplicación y elegí **Analizar con IA**. Empezá con 10 videos variados.

Se usa una imagen por petición, resolución máxima de 640 píxeles y contexto de 2048 tokens. Los modelos se descargan de memoria al terminar cada petición para reducir competencia por VRAM. El rendimiento y la asignación efectiva a GPU dependen del controlador y Ollama: no se garantiza que todo quepa en 4 GB. La ejecución en CPU puede ser lenta.

La descarga inicial necesita internet. El contenido se envía únicamente al servicio Ollama de esta misma computadora (`127.0.0.1:11434`), no a una API de nube. Elegí modelos locales, no modelos cloud. El análisis de cinco imágenes es parcial y puede omitir eventos breves. No identifica personas ni confirma fechas o lugares.

## Instalar transcripción opcional

Instalá Python 3.11 o 3.12 de https://www.python.org/downloads/windows/. Luego, desde PowerShell en esta carpeta:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install faster-whisper==1.2.1
```

Reabrí **Iniciar.cmd**. El iniciador detecta ese entorno. Empezá con 1–3 videos y **CPU**. La primera transcripción descarga el modelo `small` multilingüe en `datos/modelos`. No se descarga mientras sólo estás catalogando.

La opción GPU requiere controladores compatibles, cuBLAS CUDA 12 y cuDNN 9. Consultá https://github.com/SYSTRAN/faster-whisper antes de instalar esas bibliotecas. No hace falta configurarlas para usar CPU. La combinación GPU debe validarse en esta notebook antes de un lote extenso.

Las transcripciones tienen marcas temporales y son buscables. No distinguen hablantes. Si no hay voz se guarda un resultado vacío para evitar repetir el procesamiento. Al pausar, se termina el archivo actual; cerrando el servidor durante una transcripción el trabajador puede continuar hasta que termine. Esperá la pausa antes de cerrar para un cierre ordenado.

## Preservación y respaldo

La aplicación no contiene operaciones de mover, renombrar, borrar ni escribir metadatos en los videos. Todo el procesamiento abre los originales para lectura. Los únicos cambios son dentro de su propia carpeta de datos.

Para respaldar: cerrá la aplicación cuando no haya trabajos y copiá **toda la carpeta datos**, no sólo el archivo SQLite. También podés exportar JSON y CSV para consultar los resultados con otras herramientas. Esta versión no tiene importador de JSON; para restaurar, recuperá la carpeta datos completa.

Al cambiar el tamaño o la fecha de modificación de un video y volver a inventariar, se invalidan hash, miniatura y análisis; las etiquetas y notas humanas permanecen. Si falta un archivo en un recorrido completo, se marca como ausente y no se borra del catálogo. Un recorrido con errores de permisos no declara ausencias. Los enlaces y uniones que Windows identifica como enlaces se omiten para reducir recorridos repetidos.

## Discos externos y NAS

Agregá cada biblioteca como fuente con un nombre propio. Ejemplos: `E:\Videos` o `\\NAS\Videos`. Si cambia la letra o la ubicación, usá la flecha junto a la fuente para actualizarla. No agregues la misma biblioteca como fuente nueva si querés conservar sus identidades.

La comprobación de cambio de ubicación revisa hasta 5 archivos por ruta y tamaño; compara SHA-256 si ya estaba calculado. **No verifica una migración completa ni sustituye una copia comprobada.** Antes de retirar un disco original, verificá el contenido completo con una herramienta de copias. Después, volvé a inventariar la fuente.

Mantené `datos` en un disco local. SQLite activo no debe ponerse en un recurso SMB. Los videos sí pueden estar en el NAS. Para varios equipos escritores, el siguiente paso sería un servicio central con PostgreSQL.

## Límites de esta versión

- Búsqueda textual con coincidencias parciales, no semántica. Las tildes influyen en las coincidencias.
- No detecta duplicados recomprimidos, recortes ni similitud visual.
- No mueve ni propone automáticamente carpetas físicas; organiza mediante categorías y etiquetas.
- La clasificación visual básica se consulta por separado. Generar minuta usa la transcripción completa y la lectura opcional de nombres en pantalla.
- No tiene límite automático de caché ni control térmico. Vigilá el espacio libre; podés borrar miniaturas con la aplicación cerrada, pero luego se debe reiniciar su referencia en el catálogo para regenerarlas. Conservá el respaldo.
- Los modelos visuales, el audio y sus dependencias no se incluyen en el paquete y deben probarse con material real después de instalarlos.
- No está diseñada para exponerse a internet. Escucha sólo en 127.0.0.1, valida el host y protege las escrituras con un token de sesión.

## Configuración avanzada

Variables opcionales: `VIDEOTECA_PORT` (predeterminado 43127), `VIDEOTECA_DATA` (ruta local de datos), `VIDEOTECA_FFMPEG`, `VIDEOTECA_FFPROBE`, `VIDEOTECA_PYTHON` (ruta al ejecutable).

Desarrollo: `node server.js` para iniciar sin abrir navegador; `node --test test/*.test.js` para ejecutar pruebas. No hay instalación npm.

El primer piloto recomendado sigue siendo 50–100 videos variados para inventario y miniaturas, 10 para visión y 1–3 para transcripción. El tamaño de 1 TB no permite estimar duración sin medir las horas y los formatos reales.


## Progreso y velocidad de transcripción

Los trabajos nuevos muestran fases de carga, preparación de audio y transcripción. El porcentaje se calcula con la posición del último segmento procesado sobre la duración total del audio; puede avanzar a saltos y saltar silencios. Durante carga y preparación no hay un porcentaje fiable. El tiempo restante es una estimación que se estabiliza con el avance. El porcentaje corresponde al video actual; el contador sigue indicando archivos procesados.

El modo Rápido usa el mismo modelo small, beam_size=1 y ocho hilos CPU; Equilibrado usa beam_size=3 y cuatro hilos. Rápido puede reducir precisión en audios difíciles y su mejora debe medirse con material real. Elegí Español o Inglés si conocés el idioma, o detección automática si cambia. La GPU sigue siendo opcional y requiere cuBLAS CUDA 12 y cuDNN 9 compatibles. Actualizar no cambia un trabajador que ya está ejecutándose: esperá a que termine antes de reiniciar.


## Minutas basadas en el contenido de la reunión

1. Marcá los videos y elegí Transcribir → Preciso (Whisper medium). Se puede volver a transcribir un video; el resultado anterior sólo se reemplaza si finaliza correctamente. Mayor capacidad usa large-v3 en CPU y requiere otra descarga; puede ser mucho más lento.
2. Abrí el video y revisá la transcripción. Los tramos dudosos se señalan con una heurística, que no detecta todos los errores. Podés corregir el texto; una corrección invalida la minuta previa.
3. Marcá el video y elegí Generar minuta. Elegí Qwen3 4B para texto y el modelo visual para buscar etiquetas de nombres. La lectura de pantalla toma entre 6 y 24 muestras; puede omitir nombres breves o leerlos mal.
4. El borrador muestra temas, decisiones explícitas, acciones, pendientes y nombres con citas y botones para abrir el momento del video. Se puede exportar a Markdown. Un nombre mencionado no confirma asistencia. Los nombres visibles y mencionados se distinguen; esta versión no identifica voces ni vincula automáticamente cada frase con una persona.

Ejecutá Configurar-minutas.cmd si faltan Qwen3 4B y Whisper medium. Descarga varios GB y no procesa videos. No hay garantía de transcripción literal exacta ni de una minuta exhaustiva. Las citas se comprueban como coincidencias de texto; esa comprobación no garantiza que el resumen interprete correctamente el contexto. La transcripción y la lectura visual pueden contener errores. El texto del video se trata como datos, no como instrucciones.

El esquema del catálogo se amplía automáticamente al iniciar. Las minutas y el detalle de transcripción se incluyen en la exportación JSON. La aplicación no sube los videos ni el audio a servicios externos.
