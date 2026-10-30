# ADR-0002 — Proteger el catálogo antes de migrar

- Fecha: 2026-10-30 (America/Buenos_Aires).
- Estado: aceptada, implementada y validada para la versión 1.1.0.
- Incremento: A de ARQUITECTURA.md.
- No incluye: reanudación por video, cancelación de IA ni evaluación de calidad de minutas.

## Problema

Abrir la base actual recupera trabajos antes de comprobar que otro servidor no la utiliza. No hay versión de esquema ni un respaldo consistente integrado antes de migrar. Una segunda instancia puede alterar estados ajenos; una migración no verificada dificulta volver atrás.

## Decisión

1. Reservar primero el puerto HTTP. Si está ocupado, salir sin abrir ni modificar el catálogo.
2. Adquirir propiedad exclusiva del directorio mediante un registro en una base SQLite auxiliar `instancia.sqlite`: transacción de escritura, PID y token aleatorio del propietario. Es independiente del catálogo y de sus respaldos.
3. Si el propietario está vivo o su existencia es incierta, rechazar el inicio. Si murió, recuperar la propiedad transaccionalmente. Un PID reutilizado puede bloquear conservadoramente un inicio; nunca autoriza apropiarse de una instancia viva.
4. Comprobar integridad y versión del esquema. Rechazar versiones futuras antes de recuperar trabajos o aplicar cambios.
5. Antes de migrar un catálogo existente, producir un respaldo consistente con `VACUUM INTO`, verificarlo en una conexión de solo lectura y guardar manifiesto con versión, cantidades y SHA-256.
6. Aplicar DDL y recuperación de trabajos en una transacción. Si falla, revertir y conservar el respaldo.
7. Permitir crear respaldos manuales desde la app. Verificar/restaurar mediante una herramienta independiente, únicamente en una carpeta nueva o vacía, sin sobrescribir el catálogo original.

## Alternativas consideradas

| Alternativa | Motivo para no elegirla |
|---|---|
| Usar solo el puerto como bloqueo | No cubre servidores con puertos diferentes y el mismo catálogo. |
| Archivo de PID que se borra al parecer antiguo | La recuperación puede tener carreras entre iniciadores; la antigüedad no demuestra que su propietario terminó. |
| Registro de propietario dentro del catálogo | Contamina las copias restauradas con la propiedad del proceso original. |
| Copiar solo `catalogo.sqlite` mientras está abierto | Puede omitir datos confirmados que permanecen en WAL. |
| Restaurar encima del catálogo actual | Riesgo evitable de sobrescritura y mezcla con archivos WAL anteriores. |

## Contrato y límites

- Una instancia nueva no migra ni recupera trabajos mientras otra instancia compatible es propietaria.
- La exclusión requiere versiones que respeten este protocolo. Antes de actualizar deben cerrarse todas las instancias de la versión anterior, incluso las que usen otros puertos.
- El catálogo sigue en su directorio actual; esta entrega no lo mueve fuera de OneDrive automáticamente. Se recomienda disco local sin sincronización activa para el uso habitual.
- Los respaldos incluyen catálogo, transcripciones y minutas, no videos originales, herramientas, modelos ni miniaturas regenerables.
- No se borran respaldos automáticamente. El usuario debe vigilar su espacio disponible.
- El cierre inesperado sigue siendo posible. Este incremento asegura recuperación de propiedad y consistencia del catálogo; no implementa todavía cancelación ni cierre coordinado de herramientas.
- No se presume que un texto exportado a JSON/CSV sea un respaldo restaurable.

## Archivos y operaciones implementados

| Elemento | Responsabilidad |
|---|---|
| `catalog-storage.js` | Propiedad, versión, migración, respaldo, manifiesto y verificación/restauración segura. |
| `recuperar-catalogo.js` | Verificación y restauración a otra carpeta desde línea de comandos. |
| `server.js` | Reservar puerto antes de abrir datos; exponer creación de respaldo con protección de escritura. |
| Interfaz existente | Botón de respaldo y resultado visible, con recuperación ante errores. |
| Pruebas de almacenamiento y arranque | Procesos separados, caída, WAL, integridad, reversión y colisión de puerto. |

## Evidencia requerida antes de publicar

- Rechazo de segunda instancia sin alterar trabajos de la primera.
- Recuperación después de terminar forzosamente el propietario.
- Dos intentos de adquisición concurrentes: un único propietario.
- Respaldo que contiene datos confirmados en WAL y conserva las transcripciones/notas.
- Rechazo de una copia alterada y de esquemas futuros.
- Migración provocada para fallar: esquema revertido y respaldo anterior legible.
- Restauración comprobada en otra carpeta; rechazo de destino no vacío.
- Puerto ocupado: el segundo servidor no llega a crear el directorio de datos.
- Pruebas existentes y paquete descargable completos.

## Registro de ejecución

- 2026-10-30: se recupera el trabajo preliminar aislado. Se excluyen de esta entrega las modificaciones parciales de cancelación y se reservan para un incremento posterior con pruebas propias.
- 2026-10-30: se diseña la extracción de persistencia sin alterar la API de `openDatabase` que usa la aplicación.

### Resultado del incremento (2026-10-30)

Se implementaron `catalog-storage.js`, la herramienta de recuperación, el arranque con reserva de puerto, el endpoint protegido de respaldo, el botón y la versión visible en Herramientas y ayuda, y el empaquetado de los módulos nuevos. Se mantuvieron la ubicación de datos y los protocolos de procesamiento existentes. El registro y los archivos se publican junto con la versión 1.1.0; el commit correspondiente se consulta en el historial del repositorio.

| Comprobación ejecutada | Resultado observado |
|---|---|
| Segunda apertura mientras hay un propietario y un trabajo activo | Rechazada; el trabajo de la primera instancia sigue `running`. |
| Proceso terminado forzosamente con una escritura sin confirmar | Se recupera propiedad; la escritura no confirmada se revierte y el trabajo queda `interrupted`. |
| Dos procesos que intentan abrir a la vez | Solo uno adquiere propiedad; el otro recibe rechazo. |
| Migración de esquema anterior, con ruta Unicode y apóstrofe | Datos preservados; respaldo de esquema anterior verificable; la reapertura no duplica el respaldo de migración. |
| DDL provocado para fallar durante la migración | Reversión de tablas creadas en esa transacción; versión anterior intacta y copia previa verificable. |
| Imposibilidad de crear la carpeta de respaldos | La migración no agrega columnas ni cambia la versión; al resolver el impedimento puede reintentarse. |
| Respaldo con escrituras confirmadas en WAL | La copia incluye notas, transcripción y datos de minuta; se abre y comprueba desde otra carpeta. |
| Archivo de respaldo alterado | Rechazo por SHA-256; el catálogo original permanece disponible. |
| Esquema futuro | Inicio rechazado sin recuperar ni modificar el trabajo existente. |
| Puerto HTTP ocupado | Salida con error antes de crear el directorio de datos. |
| Catálogo corrupto o restauración incompleta | No se abre ni reemplaza el archivo original. |
| API de respaldo sin token | Respuesta 403 sin crear un respaldo; con token produce una copia verificable. |
| CLI de verificación | Salida correcta con manifiesto, integridad y cantidades comprobadas. |
| Windows PowerShell y ZIP extraído | 20 pruebas de la aplicación aprobadas; iniciador comprobado con Node.js v24.22.1; estructura y exclusión de datos personales comprobadas. |
| Interfaz en catálogo de prueba vacío | Versión 1.1.0 visible; el botón informa respaldo verificado, ubicación relativa y cantidad de registros. No se utilizó el catálogo personal. |

Comandos reproducibles desde el repositorio:

```powershell
node --test test/catalog.test.js test/catalog-storage.test.js test/catalog-startup.test.js test/folder-picker.test.js test/transcription-selection.test.js test/stream-progress.test.js test/vision-response.test.js test/meeting-minutes.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Empaquetar.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\verify-package.ps1
```

La primera ejecución del empaquetador reveló una dependencia de ensamblado en Windows PowerShell. Se agregó la carga explícita de `System.IO.Compression` y `System.IO.Compression.FileSystem`; después se generó y verificó el ZIP correctamente. Esta comprobación se agrega a CI, además de las pruebas existentes de la demo web y del trabajador Python.

### Consecuencias y trabajo siguiente

El respaldo es síncrono: durante una copia grande puede demorarse la API. Se prioriza consistencia en este incremento; una ejecución fuera del hilo del servidor se evaluará con mediciones. No hay borrado automático de respaldos ni reparación automática del catálogo.

La próxima decisión será el plan durable de trabajos y confirmación atómica por video. **No se declara resuelta la repetición de videos al reanudar, la cancelación uniforme, la separación completa de módulos ni la precisión de IA.** Tampoco se ejecutó una migración o restauración sobre el catálogo personal del usuario.
