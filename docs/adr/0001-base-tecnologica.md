# ADR-0001 — Base tecnológica local y límites de módulos

- Fecha: 2026-10-30 (America/Buenos_Aires).
- Estado: aceptada por el usuario en la conversación del proyecto.
- Alcance: aplicación local; la demo pública tiene un despliegue independiente.

## Contexto

La app usa Node.js 24, SQLite, HTML/CSS/JavaScript, procesos Python para transcripción y herramientas FFmpeg/Ollama. La prioridad es estabilizarla, preservar el catálogo y poder recuperar operaciones interrumpidas. Cambiar de framework no resuelve esos fallos.

## Decisión

Mantener Node.js para API y coordinación; Python para procesamiento especializado; SQLite local para catálogo y estado durable. Conservar el frontend actual y modularizar cliente API, estado de interfaz, pantallas y seguimiento de trabajos de forma incremental.

Los adaptadores de herramientas producen resultados y eventos; los servicios de aplicación deciden su validez y persistencia. La interfaz presenta el estado confirmado por el backend. Una recarga de pantalla no debe cancelar ni perder el seguimiento del trabajo.

## Alternativas consideradas

| Alternativa | Evaluación |
|---|---|
| Migración inmediata a FastAPI | Válida técnicamente, pero añade una migración sin resolver por sí misma la recuperación y persistencia. Se descarta para esta etapa. |
| Migración inmediata a React | Puede ser útil con una interfaz mayor, pero hoy aumentaría el cambio simultáneo. Se pospone hasta demostrar necesidad. |
| Microservicios y cola distribuida | Complejidad operativa innecesaria para una computadora y un usuario. |

## Consecuencias

No se impide una migración futura, pero requerirá un nuevo ADR con problema medido, coste, compatibilidad y plan de reversión. La solidez se demuestra mediante contratos, pruebas de fallos y recuperación; no se atribuye al lenguaje, framework o cantidad de agentes.

## Registro de ejecución

- 2026-10-30: se registra la decisión. No se cambia de framework ni se reorganiza masivamente la aplicación.
- Primer incremento: protección del catálogo (ADR-0002). La extracción de los demás módulos y la recuperación por video siguen pendientes.
