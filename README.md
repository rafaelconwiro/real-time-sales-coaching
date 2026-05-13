# Real-Time Sales Coaching

Copiloto comercial en tiempo real para llamadas B2B consultivas. Convierte una metodologia de venta en un sistema vivo que escucha la conversacion, detecta etapa / objeciones / senales y recomienda al vendedor que hacer en el momento correcto.

Modelo de IA: **Google Gemini** (texto live + Live API para audio).

## Estado actual del repo

Fase 0–4 implementadas. Fase 7 (audio Gemini Live) cableada pero requiere `GOOGLE_API_KEY` activa y captura de microfono desde el navegador (todavia no incluida en la UI).

- Monorepo pnpm con `apps/web` (Next.js 14), `apps/api` (NestJS 10), `packages/shared` (tipos + eventos + zod), `packages/prompts` (system prompts del coach).
- Postgres + Redis via Docker Compose.
- Prisma schema con todas las entidades del playbook + sesiones.
- WebSocket gateway (Socket.IO) con eventos tipados.
- Motor de recomendacion con dos vias: **Gemini live analysis** (cuando hay `GOOGLE_API_KEY`) y fallback de reglas heuristicas.
- Servicio post-call: resumen, score, email sugerido (Gemini).
- UI demo en `/session/demo`: simulador textual + tarjetas de etapa / recomendacion / checklist / senales.
- Seed con metodologia "Discovery B2B Consultivo".

## Quickstart

```bash
# 1. Variables de entorno
cp .env.example .env
# editar .env y poner GOOGLE_API_KEY si quieres IA real

# 2. Instalar dependencias
pnpm install

# 3. Levantar Postgres + Redis (requiere Docker Desktop)
pnpm db:up

# 4. Aplicar migraciones + seed
pnpm prisma:migrate   # crea tablas
pnpm prisma:seed      # carga workspace + metodologia demo

# 5. Levantar todo en dev
pnpm dev              # web en :3000, api en :4000, extension watch en apps/extension/dist
```

Abre [http://localhost:3000/session/demo](http://localhost:3000/session/demo).

Sin `GOOGLE_API_KEY` el copiloto sigue funcionando: el motor cae a reglas heuristicas. Es util para iterar el coaching antes de pagar tokens.

## Chrome Extension (captura de videollamada en vivo)

Captura el audio de la pestana de Google Meet / Zoom Web / Teams Web (+ mic del vendedor), lo manda al backend, abre una sesion en Gemini Live API y muestra coaching en el panel lateral de Chrome.

```bash
pnpm build:ext        # one-shot
# o
pnpm dev:ext          # esbuild watch
```

Cargar en Chrome:

1. `chrome://extensions` → activar "Modo desarrollador".
2. "Cargar descomprimida" → seleccionar `apps/extension/dist`.
3. Pin "Real-Time Sales Coach" en la barra.
4. Abrir Google Meet / Zoom Web / Teams Web en una pestana.
5. Click en el icono → "Capturar pestana". El panel lateral se abre automaticamente.

Requisitos:
- API arriba (`pnpm dev:api`) y postgres + redis vivos.
- `GOOGLE_API_KEY` configurada para que Gemini Live transcriba el audio.
- Chrome 121+ (offscreen + sidePanel APIs).

Pipeline tecnico:
```
Pestana videollamada audio + mic vendedor
   → AudioWorklet downsample a PCM16 16kHz mono (chunks 100 ms)
   → Socket.IO client:audio.chunk
   → GeminiLiveService (Live API session bidi)
   → inputAudioTranscription
   → RecommendationService analyza
   → server:state.updated / signal / recommendation
   → Sidepanel UI
```

## Arquitectura corta

```
apps/web (Next.js)
  └─ /session/demo → simulador textual + WebSocket cliente
apps/api (NestJS)
  ├─ realtime gateway (Socket.IO)
  ├─ recommendations
  │   ├─ ConversationStateService (estado por sesion, dedupe)
  │   ├─ RulesEngineService (fallback heuristico)
  │   └─ LiveAnalysisService (Gemini texto)
  ├─ transcription/GeminiLiveService (audio bidireccional)
  ├─ scoring (post-call: resumen + score + email)
  ├─ playbooks (metodologia + stages + objections + signals)
  └─ call-sessions (sesiones REST + control)
packages/shared (tipos, eventos, schemas Zod)
packages/prompts (system prompts del coach)
```

Flujo realtime cuando llega texto:

```
client:transcript.manual_chunk
  → RealtimeGateway.ingestText
  → Prisma.transcriptSegment.create
  → RecommendationService.analyzeAfterSegment
      → Gemini live analysis (si hay key) o reglas
  → server:state.updated / server:signal.detected / server:recommendation.created
```

## Documentacion principal

1. [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) — guia tecnica completa.
2. [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md) — checklist por fases.
3. [`docs/VISUAL_STUDIO_SETUP.md`](docs/VISUAL_STUDIO_SETUP.md) — setup de IDE.
4. [`.env.example`](.env.example) — variables disponibles.

## Decision brutal

No empezar construyendo una IA que hable con el cliente. Eso aumenta friccion, latencia, riesgo legal y rechazo. El primer producto es un copiloto privado para el vendedor.

## Primer hito real

Demostrar una llamada simulada donde el sistema:

1. recibe audio o texto streaming,
2. detecta etapa comercial,
3. encuentra informacion faltante,
4. sugiere una pregunta util,
5. genera resumen y score al terminar.

Implementado para texto. Audio Gemini Live esta cableado pero falta UI de captura de microfono (Fase 7).
