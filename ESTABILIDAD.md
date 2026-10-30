# Estabilización de la aplicación local

## Versión 1.1.0 — Protección del catálogo

Esta entrega implementa el incremento A de [ARQUITECTURA.md](ARQUITECTURA.md). Las decisiones, alternativas, pruebas y limitaciones se mantienen en [ADR-0001](docs/adr/0001-base-tecnologica.md) y [ADR-0002](docs/adr/0002-proteccion-catalogo.md).

Incluye exclusión entre instancias compatibles, reserva del puerto antes de abrir datos, versión de esquema, comprobación de integridad, migración transaccional, respaldo anterior a la migración, respaldo manual verificado y restauración a otra carpeta. No declara terminada toda la estabilización: la confirmación por video, los reintentos sin repetir resultados, la cancelación uniforme y la revisión de calidad de IA siguen pendientes.

## Actualizar

1. Terminá el trabajo actual o pausalo y esperá a que figure pausado. Cerrá todas las instancias anteriores, incluso si usan otro puerto. No actualices mientras haya herramientas procesando.
2. Con la aplicación cerrada, conservá una copia de su carpeta `datos` completa. Actualizá el código con `git pull` o extraé el ZIP en una carpeta separada y conservá la instalación anterior.
3. Abrí `Iniciar.cmd`. La app sigue usando su ubicación de datos actual o la indicada en `VIDEOTECA_DATA`. No mueve tus datos automáticamente.
4. Si hay una migración, crea antes un respaldo consistente en `datos/respaldos`. Si no puede respaldar o migrar, informa el error y no continúa sobre un esquema parcial.
5. Recargá la página. En Herramientas y ayuda, elegí **Crear respaldo verificado**. Conservá juntos el archivo `.sqlite` y su manifiesto `.sqlite.json`.

La protección de instancia exige que las aplicaciones compartan el nuevo protocolo. Una versión antigua abierta en otro puerto puede ignorarlo: por eso es obligatorio cerrar todas las versiones anteriores al actualizar.

## Qué contiene un respaldo

Fuentes y ubicaciones, registros de videos, clasificaciones, notas, hashes, transcripciones, minutas, trabajos y eventos que existen en SQLite. El manifiesto contiene fecha, versión del esquema, cantidades, tamaño y SHA-256. La copia se comprueba con SQLite en modo de solo lectura.

No copia videos originales, modelos, herramientas ni miniaturas. Las rutas de los originales deben seguir siendo accesibles después de restaurar. Si faltan miniaturas, pueden regenerarse. Respaldar el catálogo no reemplaza respaldar los videos.

No se eliminan respaldos automáticamente. Vigilá el espacio disponible. Los respaldos contienen texto y ubicaciones personales: guardalos en una ubicación privada. La copia consistente se realiza de forma síncrona; un catálogo grande puede demorar temporalmente otras respuestas de la API durante el respaldo.

## Verificar y restaurar

Cerrá la aplicación antes de recuperar. Usá Node.js 24 o posterior. En PowerShell, desde la carpeta de la aplicación:

```powershell
# Solo verifica: no cambia el catálogo activo.
node .\recuperar-catalogo.js "C:\Respaldos\catalogo-ejemplo.sqlite"

# Copia a una carpeta nueva o vacía; nunca reemplaza el catálogo actual.
node .\recuperar-catalogo.js "C:\Respaldos\catalogo-ejemplo.sqlite" "C:\Videoteca-recuperada"
```

La copia `.sqlite.json` debe estar al lado del respaldo. Una suma que no coincide, un manifiesto inválido o un esquema futuro detienen la recuperación. Una carpeta de destino no vacía se rechaza. Si una restauración se interrumpe, el marcador `.restauracion-en-curso` impide abrir esa copia incompleta: verificá el respaldo y repetí en otra carpeta nueva.

Para probar la copia sin reemplazar la ubicación original, iniciá desde una ventana nueva de PowerShell:

```powershell
$env:VIDEOTECA_DATA = 'C:\Videoteca-recuperada'
.\Iniciar.cmd
```

Comprobá fuentes, cantidad de videos, notas, transcripciones y minutas. Conservá el catálogo anterior. Las rutas de discos desconectados no se hacen accesibles por restaurar la base. Esta entrega no cambia automáticamente la carpeta de herramientas ni la ubicación que usa el servicio Ollama para sus modelos.

## Ante un error de inicio

- **Puerto ocupado:** se sale sin abrir ni migrar el catálogo. Revisá la instancia que ya está abierta.
- **Catálogo abierto en otro proceso:** cerrá esa instancia. Si se cayó, la siguiente apertura puede recuperar la propiedad al confirmar que su proceso terminó. Si Windows no permite determinarlo, se rechaza conservadoramente; no borres `catalogo.sqlite` para desbloquearlo.
- **Versión de esquema más nueva:** usá una aplicación compatible. No se degrada el esquema.
- **Integridad o migración fallida:** conservá `datos`, revisá el respaldo anterior y recuperá en otra carpeta. No se intenta una reparación automática destructiva.
- **No se puede respaldar:** revisá permisos, espacio libre y sincronización de la carpeta antes de reintentar. Los respaldos verificados necesitan tanto `.sqlite` como `.json`.

Se recomienda guardar SQLite en un disco local fuera de carpetas sincronizadas. Esta entrega no migra automáticamente la instalación actual de OneDrive ni almacena la base sobre un NAS.
