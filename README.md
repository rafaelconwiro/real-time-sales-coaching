# Real-Time Sales Coaching

Herramienta de asistencia comercial en tiempo real para llamadas y videollamadas. El objetivo no es crear otro grabador de reuniones: el producto debe convertir una metodologia de venta en un copiloto operativo que escucha la conversacion, detecta etapa/objeciones/senales comerciales y recomienda al vendedor que hacer en el momento correcto.

## Objetivo del MVP

Construir un copiloto silencioso para vendedores B2B consultivos:

- Captura audio de una llamada o videollamada.
- Transcribe en tiempo real.
- Identifica etapa de venta, objeciones, informacion faltante y senales de compra/riesgo.
- Recomienda preguntas, argumentos y proximos pasos.
- Genera resumen, scoring y acciones post-call.

## Documentacion principal

1. [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) — guia tecnica completa de arquitectura, modulos, datos, IA, realtime y roadmap.
2. [`docs/VISUAL_STUDIO_SETUP.md`](docs/VISUAL_STUDIO_SETUP.md) — guia practica para abrir, configurar y trabajar el proyecto desde Visual Studio Code / Visual Studio.
3. [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md) — checklist ordenado para ejecutar el desarrollo.
4. [`.env.example`](.env.example) — variables de entorno previstas para el MVP.

## Decision brutalmente importante

No empezar construyendo una IA que hable con el cliente. Eso aumenta friccion, latencia, riesgo legal y rechazo. El primer producto debe ser un copiloto privado para el vendedor.

## Stack recomendado para el MVP

- Frontend: Next.js + TypeScript.
- Backend: NestJS o Fastify + TypeScript.
- Realtime: WebSockets para eventos internos; WebRTC o streaming de audio segun canal.
- Base de datos: PostgreSQL.
- Cache/estado vivo: Redis.
- IA: transcripcion realtime + LLM para deteccion/comentarios + RAG sobre playbook.
- Integraciones iniciales: ninguna profunda. Primero exportacion manual/webhook. HubSpot despues.

## Primer hito real

Demostrar una llamada simulada donde el sistema:

1. recibe audio o texto streaming,
2. detecta etapa comercial,
3. encuentra informacion faltante,
4. sugiere una pregunta util,
5. genera resumen y score al terminar.

Si eso no aporta valor, todo lo demas sobra.
