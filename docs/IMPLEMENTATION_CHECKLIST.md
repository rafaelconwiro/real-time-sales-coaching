# Checklist de implementacion

Este checklist esta ordenado para evitar el error tipico: construir integraciones, audio y dashboards antes de validar que el coaching realmente ayuda.

## Fase 0 — Base del proyecto

- [ ] Crear monorepo con `apps/web`, `apps/api`, `packages/shared`, `packages/prompts`.
- [ ] Configurar pnpm workspace.
- [ ] Crear frontend Next.js con TypeScript.
- [ ] Crear backend NestJS o Fastify con TypeScript.
- [ ] Crear Docker Compose con PostgreSQL y Redis.
- [ ] Configurar `.env` desde `.env.example`.
- [ ] Configurar ESLint y Prettier.
- [ ] Configurar healthcheck API.
- [ ] Crear README tecnico de arranque.

## Fase 1 — Modelo de datos minimo

- [ ] Crear modelo `Workspace`.
- [ ] Crear modelo `User`.
- [ ] Crear modelo `SalesMethodology`.
- [ ] Crear modelo `PlaybookStage`.
- [ ] Crear modelo `PlaybookQuestion`.
- [ ] Crear modelo `PlaybookObjection`.
- [ ] Crear modelo `PlaybookSignal`.
- [ ] Crear modelo `CallSession`.
- [ ] Crear modelo `TranscriptSegment`.
- [ ] Crear modelo `DetectedSignal`.
- [ ] Crear modelo `LiveRecommendation`.
- [ ] Crear modelo `CallScore`.
- [ ] Ejecutar primera migracion.
- [ ] Crear seed con una metodologia demo.

## Fase 2 — Simulador textual realtime

- [ ] Crear pantalla `/session/demo`.
- [ ] Crear componente `TranscriptSimulator`.
- [ ] Crear componente `CurrentStageCard`.
- [ ] Crear componente `MissingFieldsChecklist`.
- [ ] Crear componente `LiveRecommendationCard`.
- [ ] Crear componente `SignalsTimeline`.
- [ ] Crear WebSocket gateway en API.
- [ ] Crear evento `client:transcript.manual_chunk`.
- [ ] Crear evento `server:recommendation.created`.
- [ ] Persistir segmentos de transcripcion.
- [ ] Mostrar recomendaciones en el frontend.

## Fase 3 — Motor comercial sin IA

- [ ] Crear `ConversationStateService`.
- [ ] Crear `RecommendationService`.
- [ ] Detectar keywords basicas de precio, timing, decisor y presupuesto.
- [ ] Detectar campos faltantes.
- [ ] Calcular etapa inicial por reglas simples.
- [ ] Generar recomendaciones hardcodeadas por objecion.
- [ ] Evitar duplicar la misma recomendacion muchas veces.
- [ ] Agregar prioridad a cada recomendacion.

## Fase 4 — IA para analisis live

- [ ] Crear prompt `packages/prompts/sales-coach/live-analysis.md`.
- [ ] Crear schema Zod para respuesta JSON.
- [ ] Implementar `LiveAnalysisService`.
- [ ] Enviar solo ventana reciente de conversacion, no transcript completo.
- [ ] Incluir playbook estructurado en contexto.
- [ ] Validar salida JSON.
- [ ] Fallback a reglas si la IA falla.
- [ ] Loguear input/output para debugging.
- [ ] Medir latencia por recomendacion.

## Fase 5 — Playbook Builder

- [ ] Crear vista de metodologias.
- [ ] Crear formulario de nueva metodologia.
- [ ] Permitir pegar texto/manual.
- [ ] Permitir subida de archivo mas adelante.
- [ ] Crear prompt `playbook-structuring.md`.
- [ ] Extraer etapas.
- [ ] Extraer preguntas.
- [ ] Extraer objeciones.
- [ ] Extraer senales.
- [ ] Permitir edicion humana antes de activar.
- [ ] Activar metodologia.

## Fase 6 — Post-call intelligence

- [ ] Crear prompt `post-call-summary.md`.
- [ ] Generar resumen ejecutivo.
- [ ] Extraer pain points.
- [ ] Extraer objeciones.
- [ ] Extraer proximos pasos.
- [ ] Calcular score por etapa.
- [ ] Detectar campos faltantes.
- [ ] Generar email de follow-up.
- [ ] Crear pantalla de resultado de llamada.
- [ ] Permitir copiar notas al portapapeles.

## Fase 7 — Audio real

- [ ] Capturar microfono desde navegador.
- [ ] Pedir permisos de audio.
- [ ] Enviar audio por WebSocket/WebRTC.
- [ ] Integrar proveedor de transcripcion realtime.
- [ ] Manejar transcript parcial y final.
- [ ] Asociar segmentos a una sesion.
- [ ] Probar con audio malo, acentos y ruido.
- [ ] Medir latencia total.

## Fase 8 — Telefonia y videollamadas

- [ ] Evaluar extension Chrome para Meet/Zoom.
- [ ] Evaluar captura local de audio del sistema.
- [ ] Integrar Twilio Media Streams para llamadas telefonicas.
- [ ] Crear canal `phone` en `CallSession`.
- [ ] Gestionar consentimiento y aviso de grabacion/transcripcion.

## Fase 9 — Integraciones comerciales

- [ ] Export markdown.
- [ ] Webhook generico.
- [ ] HubSpot notes.
- [ ] HubSpot contacts/deals.
- [ ] Salesforce despues, no antes.

## Fase 10 — Seguridad y cumplimiento

- [ ] Politica de retencion de datos.
- [ ] Opcion borrar llamada.
- [ ] Opcion no guardar audio.
- [ ] Separacion por workspace.
- [ ] Proteccion de endpoints.
- [ ] Validacion de permisos por rol.
- [ ] Logs sin secretos.
- [ ] No usar datos del cliente para entrenar modelos sin consentimiento.

## Definition of Done del MVP

- [ ] Un usuario puede crear una metodologia demo.
- [ ] Un usuario puede iniciar una sesion demo.
- [ ] El sistema recibe texto streaming.
- [ ] El sistema detecta etapa y campos faltantes.
- [ ] El sistema genera recomendaciones utiles.
- [ ] El sistema genera resumen post-call.
- [ ] El sistema calcula score basico.
- [ ] Todo funciona localmente con `pnpm dev`.
- [ ] Hay seed data para probar en menos de 5 minutos.

## Criterio brutal de avance

No pasar a integraciones ni audio real hasta que el simulador textual sea util. Si el coaching no funciona con texto perfecto, el audio solo va a esconder el problema real.
