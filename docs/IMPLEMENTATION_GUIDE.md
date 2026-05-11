# Guia de implementacion — Real-Time Sales Coaching

## 1. Vision del producto

El producto debe actuar como un copiloto comercial en tiempo real. Escucha una llamada o videollamada, entiende la conversacion y ayuda al vendedor a ejecutar mejor su metodologia de venta.

La tesis correcta es esta:

> Convertir una metodologia comercial en un sistema vivo que guia al vendedor durante la conversacion y convierte cada llamada en datos accionables.

No venderlo como una IA generica que escucha reuniones. Eso ya esta lleno de competidores. La ventaja debe estar en la ejecucion metodologica: discovery, objeciones, argumentos, senales, cierre y seguimiento.

## 2. Principios de producto

### 2.1 Copiloto silencioso primero

La primera version no debe hablar con el cliente. Debe asistir al vendedor en privado.

Razon:

- menos friccion;
- menor riesgo legal;
- menor latencia percibida;
- menor rechazo del vendedor;
- mas facil de probar en llamadas reales.

### 2.2 Sugerencias cortas

Durante una llamada, el vendedor no puede leer parrafos. Cada recomendacion debe ser minima:

```txt
Objecion detectada: precio
Accion: no justificar todavia. Preguntar comparacion.
Pregunta sugerida: "Comparado con que alternativa lo estas midiendo?"
```

### 2.3 Metodologia como nucleo

La transcripcion no es el producto. El producto es el motor que interpreta la llamada contra una metodologia comercial.

La metodologia debe estructurarse en:

- etapas;
- objetivos por etapa;
- preguntas obligatorias;
- campos que deben descubrirse;
- objeciones frecuentes;
- argumentos recomendados;
- senales de compra;
- senales de riesgo;
- reglas de cierre;
- criterios de scoring.

## 3. Alcance recomendado del MVP

### Caso de uso inicial

Discovery comercial B2B consultivo para empresas que venden software, servicios tecnicos o soluciones complejas.

### Usuario inicial

- vendedor B2B;
- responsable comercial;
- founder que vende proyectos o soluciones;
- equipo pequeno/mediano que necesita estandarizar ventas.

### Funcionalidades MVP

1. Crear una cuenta/espacio de trabajo.
2. Crear o subir una metodologia comercial.
3. Convertir esa metodologia en playbook estructurado.
4. Iniciar una sesion de llamada simulada o real.
5. Recibir transcripcion en tiempo real.
6. Detectar etapa comercial.
7. Detectar objeciones y senales.
8. Mostrar recomendaciones en vivo.
9. Mostrar checklist de informacion faltante.
10. Generar resumen y scoring post-call.

### No incluir en MVP

- IA hablando con el cliente;
- integracion profunda con Salesforce;
- automatizaciones complejas;
- analisis emocional por voz;
- dashboards enterprise excesivos;
- multi-idioma avanzado;
- extension Chrome desde el dia 1, salvo que sea estrictamente necesaria.

## 4. Arquitectura general

```txt
[Audio / Texto streaming]
        ↓
[Capture Layer]
        ↓
[Realtime Gateway]
        ↓
[Transcription Service]
        ↓
[Conversation State Engine]
        ↓
[Sales Methodology Engine]
        ↓
[Recommendation Engine]
        ↓
[Frontend Copilot Panel]
        ↓
[Post-call Summary + Score + CRM Export]
```

## 5. Stack recomendado

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Zustand o Redux Toolkit para estado de sesion
- WebSocket client para eventos realtime

### Backend

Opcion recomendada: NestJS + TypeScript.

Modulos:

- AuthModule
- WorkspaceModule
- PlaybookModule
- CallSessionModule
- RealtimeModule
- TranscriptionModule
- RecommendationModule
- ScoringModule
- IntegrationModule

### Base de datos

PostgreSQL.

ORM recomendado:

- Prisma si se quiere velocidad de desarrollo;
- Drizzle si se quiere mas control tipado.

### Estado realtime

Redis para:

- estado vivo de una llamada;
- buffers temporales de transcripcion;
- locks/eventos;
- pub/sub interno si se escala.

### IA

Separar tres funciones:

1. **Transcripcion realtime**
   - convierte audio a texto parcial/final.

2. **Analisis rapido en vivo**
   - detecta etapa, objeciones, campos faltantes y recomendacion.

3. **Analisis profundo post-call**
   - resumen, score, coaching y CRM notes.

No usar el mismo flujo para todo. Lo realtime debe ser rapido y barato. Lo post-call puede ser mas lento y profundo.

## 6. Estructura de carpetas propuesta

```txt
real-time-sales-coaching/
  apps/
    web/
      src/
        app/
        components/
        features/
          copilot/
          playbooks/
          sessions/
        lib/
        styles/
    api/
      src/
        modules/
          auth/
          workspaces/
          playbooks/
          call-sessions/
          realtime/
          transcription/
          recommendations/
          scoring/
          integrations/
        common/
        config/
        main.ts
  packages/
    shared/
      src/
        types/
        schemas/
        events/
    prompts/
      sales-coach/
        live-analysis.md
        post-call-summary.md
        playbook-structuring.md
  prisma/
    schema.prisma
    migrations/
  docs/
  docker-compose.yml
  .env.example
  package.json
  pnpm-workspace.yaml
```

## 7. Modelo de datos base

### Workspace

Representa una empresa/equipo.

Campos:

- id
- name
- createdAt
- updatedAt

### User

Campos:

- id
- workspaceId
- name
- email
- role: `admin | manager | seller`
- createdAt
- updatedAt

### SalesMethodology

Documento padre de una metodologia.

Campos:

- id
- workspaceId
- name
- description
- rawContent
- status: `draft | active | archived`
- createdAt
- updatedAt

### PlaybookStage

Etapas de la venta.

Campos:

- id
- methodologyId
- name
- order
- goal
- exitCriteria

Ejemplos:

- Opening
- Discovery
- Qualification
- Solution Framing
- Objection Handling
- Closing
- Next Steps

### PlaybookQuestion

Campos:

- id
- stageId
- question
- purpose
- priority: `low | medium | high`

### PlaybookObjection

Campos:

- id
- methodologyId
- name
- detectionExamples
- recommendedResponse
- recommendedQuestions

### PlaybookSignal

Campos:

- id
- methodologyId
- type: `buying_signal | risk_signal | missing_info | competitor | urgency | budget`
- name
- detectionExamples
- recommendedAction

### CallSession

Campos:

- id
- workspaceId
- sellerId
- methodologyId
- title
- channel: `simulation | browser_audio | phone | video_call`
- status: `created | live | ended | failed`
- startedAt
- endedAt

### TranscriptSegment

Campos:

- id
- callSessionId
- speaker: `seller | prospect | unknown`
- text
- isFinal
- startMs
- endMs
- createdAt

### DetectedSignal

Campos:

- id
- callSessionId
- transcriptSegmentId
- type
- label
- confidence
- evidence
- createdAt

### LiveRecommendation

Campos:

- id
- callSessionId
- type: `question | argument | warning | next_step | objection_response`
- title
- message
- suggestedPhrase
- priority
- reason
- createdAt

### CallScore

Campos:

- id
- callSessionId
- overallScore
- discoveryScore
- qualificationScore
- objectionScore
- closingScore
- methodologyAdherence
- missingFields
- strengths
- improvements
- createdAt

## 8. Eventos realtime

Usar eventos tipados compartidos entre frontend y backend.

### Cliente → servidor

```ts
client:session.start
client:session.end
client:audio.chunk
client:transcript.manual_chunk
client:recommendation.dismiss
client:recommendation.accept
```

### Servidor → cliente

```ts
server:transcript.partial
server:transcript.final
server:stage.detected
server:signal.detected
server:recommendation.created
server:session.score.updated
server:error
```

## 9. Flujo realtime recomendado

### 9.1 Inicio de sesion

1. Usuario selecciona playbook.
2. Usuario inicia llamada/simulacion.
3. Backend crea `CallSession`.
4. Frontend abre WebSocket.
5. Backend carga metodologia activa en memoria/Redis.

### 9.2 Durante la llamada

1. Audio o texto entra por streaming.
2. Se genera transcripcion parcial.
3. Cada N segundos o cada segmento final se analiza.
4. El motor actualiza estado comercial:
   - etapa actual;
   - informacion descubierta;
   - objeciones;
   - riesgos;
   - siguientes preguntas.
5. Se emite recomendacion si hay una accion clara.

### 9.3 Fin de llamada

1. Se cierra streaming.
2. Se consolida transcripcion.
3. Se ejecuta analisis post-call.
4. Se genera:
   - resumen;
   - score;
   - proximos pasos;
   - email sugerido;
   - notas CRM.

## 10. Motor de metodologia

Este es el componente clave.

Entrada:

```json
{
  "currentStage": "discovery",
  "recentTranscript": "Cliente: ahora mismo lo vemos caro...",
  "knownFields": {
    "pain": "mucho trabajo manual",
    "budget": null,
    "decisionMaker": null,
    "timeline": "Q3"
  },
  "playbook": {
    "stageGoal": "identificar dolor, impacto, presupuesto y decisor",
    "requiredFields": ["pain", "impact", "budget", "decisionMaker", "timeline"],
    "objections": ["price", "timing", "no need"]
  }
}
```

Salida:

```json
{
  "stage": "discovery",
  "detectedSignals": [
    {
      "type": "objection",
      "label": "price",
      "confidence": 0.82,
      "evidence": "lo vemos caro"
    }
  ],
  "missingFields": ["budget", "decisionMaker"],
  "recommendation": {
    "type": "question",
    "title": "Profundiza antes de defender precio",
    "message": "No justifiques todavia. Entiende contra que alternativa comparan el precio.",
    "suggestedPhrase": "Cuando dices que lo ves caro, ¿comparado con que alternativa o coste actual lo estas midiendo?"
  }
}
```

## 11. Prompts base

### 11.1 Playbook structuring

Objetivo: convertir texto libre en estructura operativa.

Debe extraer:

- etapas;
- objetivos;
- preguntas;
- objeciones;
- argumentos;
- criterios de salida;
- campos requeridos;
- score rubric.

### 11.2 Live analysis

Debe ser estricto:

- no inventar informacion;
- responder solo con JSON;
- recomendar solo si hay una accion clara;
- no saturar al vendedor;
- priorizar discovery y avance de etapa.

### 11.3 Post-call summary

Debe generar:

- resumen ejecutivo;
- pain points;
- objeciones;
- senales positivas;
- riesgos;
- campos faltantes;
- proximos pasos;
- email sugerido;
- score por etapa.

## 12. Interfaz del vendedor

Pantalla principal durante llamada:

```txt
┌────────────────────────────────────┐
│ Etapa actual: Discovery            │
│ Objetivo: entender dolor e impacto │
├────────────────────────────────────┤
│ Faltan datos:                      │
│ - presupuesto                      │
│ - decisor                          │
│ - impacto economico                │
├────────────────────────────────────┤
│ Recomendacion ahora                │
│ No vendas solucion todavia.        │
│ Pregunta por impacto.              │
│                                    │
│ "¿Que coste tiene mantener esto    │
│ otros 6 meses?"                   │
└────────────────────────────────────┘
```

Regla: una recomendacion principal visible. El resto en historial.

## 13. Seguridad y privacidad

### Reglas minimas

- Mostrar aviso de grabacion/transcripcion cuando aplique.
- Permitir borrar llamadas.
- No guardar audio por defecto en MVP.
- Guardar transcripcion solo si el usuario lo acepta.
- Separar datos por workspace.
- Cifrar secretos.
- No entrenar modelos con datos del cliente salvo consentimiento explicito.

### Evitar

- analisis emocional por voz;
- claims de detectar estado psicologico;
- grabaciones ocultas;
- almacenar audio innecesario;
- recomendaciones discriminatorias.

## 14. Roadmap de implementacion

### Fase 0 — Setup base

- Crear monorepo.
- Configurar Next.js.
- Configurar API NestJS/Fastify.
- Configurar PostgreSQL.
- Configurar Redis.
- Configurar variables de entorno.
- Configurar lint/test.

### Fase 1 — Simulacion sin audio

Antes de audio real, implementar texto streaming manual.

Objetivo: validar el motor comercial sin ruido tecnico.

- Pantalla de sesion.
- Textarea/input que simula frases de la llamada.
- Backend recibe chunks.
- Motor analiza chunks.
- Frontend muestra recomendaciones.

Esta fase evita perder semanas en audio antes de saber si el coaching sirve.

### Fase 2 — Playbook Builder

- Crear metodologia.
- Pegar/subir texto.
- Estructurar con IA.
- Editar etapas/preguntas/objeciones.
- Activar playbook.

### Fase 3 — Transcripcion realtime

- Captura de microfono.
- Streaming al backend o proveedor.
- Segmentos parciales/finales.
- Speaker diarization si esta disponible.

### Fase 4 — Post-call intelligence

- Resumen.
- Score.
- Seguimiento.
- Email sugerido.

### Fase 5 — Integraciones

- Export a markdown/clipboard.
- Webhook.
- HubSpot.
- Salesforce.
- Telefonia/Twilio.

## 15. Criterios de exito del MVP

El MVP funciona si en una llamada de discovery:

- detecta correctamente la etapa el 70%+ de las veces;
- identifica informacion faltante importante;
- genera preguntas utiles sin saturar;
- mejora la calidad del resumen post-call;
- el vendedor acepta/usaria al menos 3 recomendaciones por llamada;
- el manager ve valor en el scoring.

## 16. Errores que matarian el producto

1. Intentar construir un Gong completo desde el principio.
2. Empezar por integraciones enterprise.
3. Generar demasiadas sugerencias.
4. Usar prompts genericos sin metodologia estructurada.
5. No medir si las recomendaciones fueron utiles.
6. Guardar audio sin una politica clara.
7. Vender precision perfecta.
8. No diferenciar entre realtime y post-call.

## 17. Primer backlog tecnico

### Backend

- Crear entidad Workspace.
- Crear entidad User.
- Crear entidad SalesMethodology.
- Crear entidad PlaybookStage.
- Crear entidad CallSession.
- Crear entidad TranscriptSegment.
- Crear gateway WebSocket.
- Crear servicio `ConversationStateService`.
- Crear servicio `RecommendationService`.
- Crear servicio `PostCallScoringService`.

### Frontend

- Dashboard inicial.
- Vista de playbooks.
- Vista de sesion en vivo.
- Panel de recomendacion.
- Checklist de discovery.
- Vista de resumen post-call.

### IA

- Prompt de estructuracion de playbook.
- Prompt de analisis live.
- Prompt de resumen post-call.
- Validacion JSON con Zod.
- Logs de input/output para debug.

## 18. Siguiente paso recomendado

No empieces por audio. Empieza por una simulacion textual en tiempo real. Si con texto limpio el motor no da recomendaciones utiles, con audio real sera peor.

Primer objetivo de desarrollo:

> Una pantalla donde pegues frases de una llamada y el sistema responda con etapa, campos faltantes y una recomendacion util en menos de 3 segundos.
