# Roadmap — Pitaya (Real-Time Sales Coaching)

Registro de funcionalidades. `[x]` = QA pasado contra código actual. `[~]` = parcial (anotado por qué). `[ ]` = pendiente.

Última auditoría: 2026-05-14 (segunda pasada).

---

## Núcleo — captura y transcripción en vivo

- [x] Capturar audio del usuario (micrófono) — [offscreen.ts](apps/extension/src/offscreen.ts)
- [x] Capturar audio del prospect (pestaña de Meet / system audio) — tabCapture
- [x] Mezclar ambos canales y diferenciarlos (quién habló) — dos sesiones Gemini Live por canal (`seller`/`prospect`) etiqueta cada segmento; ver [gemini-live.service.ts](apps/api/src/modules/transcription/gemini-live.service.ts) + [offscreen.ts](apps/extension/src/offscreen.ts)
- [x] Transcripción en vivo en español e inglés — Gemini Live + selector de idioma en precall
- [x] Detección de pausas e interrupciones — `ServerEvents.PauseDetected` cuando hay >8s silencio entre segmentos ([realtime.gateway.ts](apps/api/src/modules/realtime/realtime.gateway.ts))
- [x] Transcript visible en panel lateral, scroll automático
- [x] Pause / resume / stop de la sesión — popup tiene 3 botones; gateway respeta paused
- [x] Indicador visual de estado (idle / listening / analyzing / coaching) — `CoachingStatus` emite vía `ServerEvents.StatusChanged`; sidepanel muestra

## Coaching en vivo

- [x] Detección de stage actual de la conversación
- [x] Pregunta sugerida basada en lo último que dijo el prospect
- [x] Alerta de error inminente (pitching antes de tiempo, respondiendo en vez de preguntar) — `RulesEngineService.detectPrematurePitch` + `detectAnsweringInsteadOfAsking` en [rules-engine.service.ts](apps/api/src/modules/recommendations/rules-engine.service.ts)
- [x] Detección de buying signals — enum `SignalType.buying_signal` + Live analysis
- [x] Detección de risk signals — `SignalType.risk_signal`
- [x] Detección de objeciones — `SignalType.objection` + `PlaybookObjection`
- [x] Respuesta sugerida a la objeción detectada (Clarify-Discuss-Diffuse) — `recommendedResponse` en playbook
- [x] Checklist de información faltante por capturar — [MissingFieldsChecklist.tsx](apps/web/src/components/copilot/MissingFieldsChecklist.tsx)
- [x] Timeline visual de señales que aparecieron durante la llamada — [SignalsTimeline.tsx](apps/web/src/components/copilot/SignalsTimeline.tsx)

## Playbook / metodología

- [x] Biblioteca de metodologías cargadas — 2 seed: "Discovery B2B Consultivo" + "NEPQ+ (Jeremy Miner)"
- [x] Selector de metodología activa antes de la llamada
- [x] Visualización de stages y exit criteria — sidepanel muestra `exitCriteria` por stage al detectarse
- [x] Editor de metodologías (crear, duplicar, editar) — [/methodologies](apps/web/src/app/methodologies/page.tsx) + [/methodologies/[id]](apps/web/src/app/methodologies/[id]/page.tsx)
- [~] Ingesta de documento → estructuración automática — soporta texto crudo vía Gemini ([playbooks.service.ts](apps/api/src/modules/playbooks/playbooks.service.ts)); PDF/doc parsing aún no
- [x] Versioning de metodologías — tabla `MethodologyVersion`, snapshot en update, restore disponible
- [x] Activar/desactivar metodologías — botones activar/archivar en library

## Pre-call

- [x] Pantalla de setup pre-llamada
- [~] Test de audio — test de micro funcional (level meter); test de captura de pestaña aún no integrado en precall (requiere popup en pestaña destino)
- [x] Notas previas sobre el prospect — entidad `Prospect` con notas; selector en precall carga histórico
- [x] Selección de idioma de la llamada — selector ES/EN en precall

## Post-call

- [x] Score de la llamada
- [x] Resumen automático de la conversación
- [x] Información capturada vs faltante
- [x] Lista de objeciones que aparecieron y cómo se manejaron
- [x] Próximos pasos detectados / sugeridos
- [x] Borrador de email de follow-up + botón "Copiar"
- [x] Transcript completo descargable — `GET /api/sessions/:id/transcript.txt` + botón en [/session/[id]](apps/web/src/app/session/[id]/page.tsx)
- [x] Highlights de momentos clave (timestamps) — `GET /api/sessions/:id/highlights` filtra señales y recs de alta prioridad con offset desde inicio
- [x] Comparativa con llamadas anteriores — `GET /api/sessions/comparative` + chart en detalle de sesión

## Historial

- [x] Lista de sesiones pasadas — [/history](apps/web/src/app/history/page.tsx)
- [x] Búsqueda en transcripts — `?search=` busca en título, prospect y `TranscriptSegment.text`
- [x] Filtros — por tag y metodología (stage filter pendiente como filtro derivado)
- [x] Etiquetado manual de llamadas (won, lost, follow-up) — `CallTag` enum + `PATCH /api/sessions/:id/tag` + selector inline en tabla
- [x] Replay de sesión con coaching en línea de tiempo — pestaña "Replay" en detalle de sesión muestra segments + signals + recommendations ordenados por offset

## Plataformas de meeting

- [x] Soporte Google Meet (browser tab capture) — tabCapture vía pestaña
- [~] Soporte Zoom — funciona en Zoom Web; falta app desktop
- [~] Soporte Microsoft Teams — funciona en Teams Web; falta app desktop
- [ ] Guía de setup de BlackHole (Mac) o VB-Cable (Windows)
- [ ] Detección automática de qué plataforma está activa

## Identidad y branding (Pitaya)

- [ ] Logo "The Slice" en todas las superficies
- [ ] Wordmark "pıtaya" con punto glossy animado
- [ ] Logo animado por estado (idle, listening, analyzing, coaching)
- [ ] Paleta hot pink / orange / verde aplicada consistentemente
- [ ] Dark mode + light mode toggle — UI actual es dark fijo
- [ ] Reemplazo de "Real-Time Sales Coach" en manifest, sidepanel, popup — manifest sigue con nombre viejo ([manifest.json:3](apps/extension/src/manifest.json#L3))

## Onboarding

- [ ] Primera vez: tour guiado de 60 segundos
- [ ] Setup wizard de audio
- [ ] Carga inicial de metodología
- [ ] Llamada de prueba simulada para entender la interfaz
- [ ] Estado vacío en cada pantalla con explicación

## Configuración

- [ ] Preferencias de coaching (frecuencia / agresividad)
- [ ] Idioma de la interfaz
- [~] Modelo de IA a usar — vía env var (`google.textModel`), sin UI
- [ ] Volumen / sensibilidad de transcripción
- [ ] Reset de setup de audio
- [ ] Export de datos

## Multi-usuario / cuenta

- [ ] Login / signup
- [~] Workspaces — modelo `Workspace` en schema, sin UI
- [~] Roles — enum `UserRole` (admin/manager/seller), sin enforcement
- [ ] Compartir playbook entre miembros del workspace
- [ ] Dashboard de manager
- [ ] Benchmark entre vendedores

## Integraciones

- [ ] HubSpot
- [ ] Salesforce
- [ ] Pipedrive
- [ ] Google Calendar (pre-fill prospect)
- [ ] Slack
- [ ] Gmail / Outlook
- [ ] Notion / Coda

## Telefonía

- [~] Soporte llamadas telefónicas — schema tiene `SessionChannel.phone`, sin impl Twilio
- [ ] Captura de audio desde número dedicado
- [ ] Integración con dialers (Aircall, RingCentral)

## Análisis avanzado

- [ ] Talk-to-listen ratio
- [ ] Velocidad de habla
- [ ] Tono emocional del prospect
- [ ] Tiempo en cada stage
- [ ] Patrones de objeciones más frecuentes
- [ ] Reportes mensuales / trimestrales

## Privacidad y compliance

- [ ] Consentimiento de grabación (pop-up obligatorio)
- [ ] Encriptación de transcripts en reposo
- [ ] Borrado automático después de X días
- [ ] GDPR compliance (export y delete)
- [ ] SOC 2

## Mobile

- [ ] App móvil para revisar llamadas
- [ ] Notificaciones push de scores y highlights

## IA avanzada (futuro)

- [ ] Roleplay con IA
- [ ] Sugerencias personalizadas según historial
- [ ] Predicción de probabilidad de cierre
- [ ] Detección de mentiras / inconsistencias
- [ ] Detección de decision maker real en multi-persona
