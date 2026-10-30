# Registro de decisiones de arquitectura

Una decisión aceptada no equivale a una función terminada. Cada ADR distingue decisión, implementación, comprobaciones y limitaciones. Las decisiones sustituidas permanecen registradas y enlazan a su reemplazo.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-base-tecnologica.md) | Mantener Node.js, procesos Python y frontend JavaScript modular | Aceptada; modularización gradual pendiente |
| [0003](0003-recuperacion-por-video.md) | Lote durable, revisión de entrada y confirmación por video | Implementada y comprobada en 1.2.0 |
| [0002](0002-proteccion-catalogo.md) | Propiedad exclusiva del catálogo, migraciones transaccionales y respaldo restaurable | Implementada y validada en 1.1.0 |

El plan general y los criterios de una versión estable están en [ARQUITECTURA.md](../../ARQUITECTURA.md). Cada cambio se registra en el ADR correspondiente con su motivo, alcance, resultado y evidencia. No se incorporan transcripciones, rutas personales ni datos de pruebas privadas.
