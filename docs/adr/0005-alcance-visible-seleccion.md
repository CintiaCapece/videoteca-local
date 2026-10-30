# ADR-0005 — Confirmar el alcance seleccionado

- Fecha: 2026-10-30.
- Estado: implementada en 1.3.1.

El diálogo de análisis visual confirmaba un video pero conservaba un aviso estático que recomendaba un lote de diez. Ese texto generaba una contradicción aparente con la selección del usuario.

Se elimina la cantidad fija y se indica que se procesarán únicamente los videos de la lista, uno por vez. La confirmación compartida por los diálogos usa singular para un video y la cantidad seleccionada para varios. La recomendación de modelo queda separada del alcance. También se actualiza el aviso de pausa de transcripción para reflejar el comportamiento de 1.3.0.

No cambia la selección ni la planificación: el frontend envía los IDs enumerados y el backend conserva el plan durable del ADR-0003. Los videos ausentes o no aptos siguen excluidos con aviso; el análisis visual existente sigue omitiéndose. Esta corrección no agrega reprocesamiento ni un lote automático de diez videos.

Verificación: sintaxis del frontend, pruebas existentes y extracción/verificación del ZIP distribuido. No se agregan pruebas que solo comparen textos de interfaz.
