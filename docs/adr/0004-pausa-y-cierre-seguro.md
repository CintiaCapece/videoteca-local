# ADR-0004 — Pausa de herramientas y cierre seguro

- Estado: implementada y comprobada en 1.3.0.
- Fecha: 2026-10-30.
- Relacionadas: ADR-0002 y ADR-0003.

## Problema

La pausa cooperativa podía esperar horas a una transcripción. Un timeout liberaba la promesa antes de confirmar que el proceso había cerrado. Tampoco existía una secuencia de cierre que esperara al motor antes de cerrar SQLite.

## Decisión

Cada ejecución tiene un AbortController. Pedir pausa cambia el trabajo a `pausing` (la interfaz muestra «Deteniendo»), activa la señal y conserva la exclusión hasta terminar la limpieza. Repetir pausa durante ese estado es idempotente. Solo después pasa a `paused`, con el elemento incompleto pendiente. Reanudar crea una señal nueva y conserva los elementos confirmados del ADR-0003.

`process-runner.js` concentra ejecución, aborto, timeout y límite de salida. Nunca usa un intérprete de comandos. Un aborto previo no lanza el ejecutable. En Windows intenta `taskkill /PID /T /F`; si falla, intenta terminar el hijo directo. En otros sistemas termina el hijo directo. No resuelve ni rechaza la ejecución hasta recibir `close` del hijo y finalizar el intento de terminación. Si el sistema impide terminarlo, permanece ocupado; no se simula una detención satisfactoria. No existe un plazo absoluto garantizado de pausa.

La señal se propaga a comprobaciones de herramientas, FFmpeg, ffprobe, Python, lectura de hashes y solicitudes HTTP de Ollama (fotogramas, lectura de pantalla y minuta). Las solicitudes HTTP combinan aborto y timeout. Se comprueba la señal después de respuestas y antes de publicar resultados o cachés: una respuesta tardía no sustituye datos anteriores ni confirma el elemento. Los mensajes de progreso posteriores al aborto se descartan. Los fotogramas temporales de IA conservan su limpieza `finally`.

El servidor maneja SIGINT/SIGTERM: deja de aceptar conexiones, interrumpe las existentes, solicita pausa y espera al motor antes de cerrar SQLite y liberar la propiedad. El motor rechaza iniciar y reanudar cuando se está cerrando. Ctrl+C en la consola es el cierre normal recomendado. Finalizar forzosamente el proceso, cerrar Windows o perder energía usa la recuperación del ADR-0003, no esta secuencia de cierre.

## Límites explícitos

- Se mantiene **Pausar/Reanudar**: esta versión no agrega un estado terminal «cancelado» ni elimina trabajos o resultados.
- Abortar HTTP corta la espera local y evita guardar su respuesta. No garantiza que el servidor Ollama deje de usar GPU en ese instante; no se apaga ni se mata el servicio compartido. La app libera el trabajo después de terminar su solicitud local, no después de una confirmación remota de cancelación.
- El cierre del proceso directo se verifica. La terminación de descendientes en Windows depende de `taskkill` y los permisos; el fallback no promete limpiar árboles arbitrarios de programas externos. Las herramientas admitidas se ejecutan directamente, sin shells.
- La miniatura parcial sin referencia puede permanecer en caché si FFmpeg se interrumpe; se sobrescribe al reintentar. No se declara transaccional la caché multimedia ni se borran modelos descargados.
- Las operaciones síncronas de SQLite y pequeños pasos del sistema de archivos no se pueden interrumpir a mitad de instrucción. No se promete pausa instantánea.
- La precisión de transcripciones, nombres y minutas no cambia. No se identifica a nadie por cara o voz.

## Alternativas

Esperar al video completo se descarta por su duración. Marcar pausado antes de cerrar el hijo permitiría solapamientos y resultados tardíos. Matar todos los procesos Python/Ollama afectaría otros programas y se descarta. Un supervisor externo o servicio adicional se difiere para conservar la instalación local actual.

## Evidencia

`test/cancellation.test.js` ejecuta un hijo Node real, pide aborto y comprueba que su PID dejó de existir al finalizar; cubre timeout, ejecutable inexistente y aborto previo al lanzamiento. Un servidor HTTP local que no responde comprueba el aborto de la solicitud visual sin reintento. Adaptadores deterministas comprueban respuesta tardía descartada, exclusión durante `pausing`, pausa repetida, cierre del motor y rechazo de nuevos trabajos, aborto de minuta y metadatos sin publicación tardía.

La prueba existente de reanudación con reemplazo se adapta a la nueva semántica: el segundo video abortado se repite; el primero confirmado se conserva. Continúan las pruebas de caída real del proceso, recuperación y migración. El ZIP se extrae y prueba de forma independiente.

Estas comprobaciones no ejecutan modelos reales ni validan la cancelación interna de Ollama. La comprobación de cierre del motor no equivale a simular Ctrl+C de consola en todas las versiones de Windows. Quedan pendientes validación con modelos reales, publicación atómica de cachés, supervisión más amplia y modularización de frontend/backend.
