# ADR-0003 — Lote durable y confirmación por video

- Estado: implementada y comprobada en 1.2.0.
- Fecha: 2026-10-30.
- Relacionadas: ADR-0001 y ADR-0002.

## Problema

Reconstruir el lote al reanudar podía repetir retranscripciones con reemplazo y minutas terminadas. El contador reiniciaba desde cero y la pertenencia al lote dependía del catálogo del momento. Un cierre entre guardar el resultado y registrar su finalización también podía provocar repeticiones.

## Decisión

Conservar Node.js y SQLite. Un módulo `job-ledger.js` registra el plan antes de empezar a consultar herramientas. Cada elemento conserva ID, orden, ubicación de fuente y huella de la revisión del archivo (ruta relativa, fuente, tamaño y modificación). Para minutas, también incluye texto y segmentos de la transcripción. La configuración permanece en el payload del trabajo.

Los estados por elemento son pending, running, succeeded y failed, con intentos e incidencia. Al reabrir, running pasa a pending y los trabajos activos a interrupted. Reanudar recorre únicamente elementos sin éxito confirmado; no vuelve a aplicar filtros ni agrega videos nuevos. Los totales provienen del plan guardado, incluidos lotes vacíos.

La transcripción, el análisis visual, la minuta y el hash se calculan fuera de transacciones. Antes de confirmar se verifica nuevamente el archivo y su revisión. Guardar el resultado, confirmar succeeded y actualizar los contadores usa una única transacción breve. Si esa transacción falla, se conserva el resultado anterior. La salida de transcripción debe contener texto, modelo y una colección de segmentos.

La comprobación de revisión evita aplicar resultados a archivos cambiados, fuentes reubicadas o transcripciones modificadas. Usa metadatos de archivo, no un hash integral previo: no detecta cambios que preserven deliberadamente tamaño y fecha. Un elemento con revisión distinta queda con incidencia; requiere un trabajo nuevo sobre el catálogo actualizado.

## Semántica y alcance

- El cálculo de un video sin confirmación puede repetirse después de una caída. No se promete ejecutar cada modelo exactamente una vez. Un video confirmado no se recalcula al reanudar el mismo trabajo, incluso si se pidió reemplazar transcripciones.
- Metadatos y miniaturas son cachés incrementales: `enrich` puede guardarlos antes de confirmar el elemento. Al reintentar se reutilizan los campos completos y se regeneran los faltantes. No tienen la misma publicación atómica que texto, minuta, análisis y hash. Inventariar un archivo cambiado invalida estos derivados.
- El inventario conserva su recorrido idempotente; reinicia el recorrido al reanudar y solo declara ausencias después de completarlo.
- Los trabajos antiguos carecen del plan: se conservan, pero los lotes anteriores a 1.2.0 no se reanudan por inferencia. La interfaz informa que se debe crear otro lote seleccionando pendientes. Los inventarios antiguos sí pueden reiniciarse.
- Pausar sigue siendo cooperativo: una transcripción en curso puede terminar antes de detener el lote. Cancelación uniforme de procesos e interrupción inmediata siguen pendientes.
- Esquema SQLite 2, con respaldo verificable previo y migración transaccional. No abrir este catálogo con una versión anterior. Restaurar un respaldo previo en otra carpeta permite volver a ella.

## Alternativas

Inferir finalización por la existencia de una transcripción se descartó: confunde resultados previos con la ejecución actual y no sirve para reemplazos. Redis/Celery u otra cola externa agregarían instalación y operación innecesarias para una aplicación local secuencial. Mantener una transacción abierta mientras procesa IA bloquearía otras operaciones y se descartó.

## Evidencia

`test/job-recovery.test.js` comprueba migración desde esquema 1 con respaldo, pausa/reanudación con reemplazo, selección persistida, reintento exclusivo de fallidos, respuesta inválida conservando texto anterior, archivo modificado durante el cálculo, rollback de resultado ante fallo del checkpoint y rechazo de reanudación antigua. Un proceso hijo real se termina durante el segundo elemento de tres; al reabrir, solo procesa segundo y tercero.

Las herramientas/modelos de esas pruebas son adaptadores deterministas internos del motor, inaccesibles por HTTP. No se descargan modelos ni se procesan videos personales. La prueba de caída valida recuperación de procesos y SQLite, no rendimiento ni calidad de IA. Las pruebas existentes cubren además inventario, duplicados, HTTP, propiedad exclusiva y respaldos. El paquete distribuido se extrae y prueba por separado.

## Pendientes

Cancelación uniforme y cierre de procesos; pruebas integrales con Ollama y faster-whisper reales; publicación transaccional de cachés multimedia; interfaz más detallada de elementos e intentos; modularización gradual de `lib.js` y frontend. La precisión de transcripción y de minutas no cambia con esta entrega.
