# Plantilla de guión de llamada

Plantilla reutilizable para B2B consultivo. Copia, personaliza placeholders `{{...}}`, pega en el campo **Guión** del precall.

El copiloto priorizará tus frases sobre las genéricas del playbook cuando encajen.

---

## Cómo usar

1. Duplica este archivo o copia el bloque de abajo.
2. Reemplaza cada `{{placeholder}}` con datos del prospect.
3. Pega el resultado en el textarea **Guión / hooks** del popup precall (botón "Configurar pre-llamada" en la extensión).
4. Guardar. Cuando arranques la llamada, el coach lo verá como contexto.

**Reglas:**
- Mantén frases cortas. El coach las extrae mejor si son <100 caracteres.
- No pongas párrafos enteros. Pon una pregunta o un hook por línea.
- Lo que escribas como "PREGUNTA:" o "HOOK:" se prioriza.

---

## Bloque para copiar

```
=== CONTEXTO ===
Prospect: {{nombre}} ({{cargo}})
Empresa: {{empresa}} ({{industria}}, {{tamaño_empleados}} empleados)
Origen del lead: {{de dónde vino — inbound, referido, outbound, evento}}
Llamadas previas: {{ninguna | número y resumen}}
Hipótesis de dolor: {{qué creo que les pasa antes de la llamada}}
Hipótesis de valor: {{por qué creo que mi solución encaja}}
Objetivo de esta llamada: {{discovery | demo | propuesta | cierre}}

=== HOOK DE APERTURA ===
HOOK: {{Frase de 1 línea para ganar permiso a indagar — neutral, sin pitchear}}
Ejemplo: "Antes de entrar en cómo trabajamos, ¿qué te llevó a aceptar esta reunión?"

=== DISCOVERY — preguntas obligatorias ===
PREGUNTA: ¿Cómo lo están haciendo hoy?
PREGUNTA: ¿Qué es lo que más te frustra de la situación actual?
PREGUNTA: ¿Hace cuánto tienen este problema?
PREGUNTA: ¿Qué han intentado para resolverlo y qué pasó?
PREGUNTA: Si esto sigue 12 meses más, ¿qué pasa?

=== DOLORES ESPECÍFICOS A INVESTIGAR ===
- {{dolor_1 — ej: pierden X horas/semana en Y}}
- {{dolor_2}}
- {{dolor_3}}

=== QUALIFICATION ===
PREGUNTA: Además de ti, ¿quién más participa en la decisión?
PREGUNTA: ¿Han asignado presupuesto para resolverlo?
PREGUNTA: ¿Para cuándo necesitarían tenerlo funcionando?
PREGUNTA: ¿Qué tendría que pasar internamente para que se firme?

=== SOLUTION FRAMING (sólo si discovery dio dolor cuantificado) ===
FRAME: "Por lo que me has contado sobre {{dolor concreto del prospect}}, lo que hace {{producto}} es {{cómo lo resuelve}}."
FRAME: "Lo que diferencia a {{producto}} de {{alternativa que mencionaron}} es {{diferencia clave}}."
NO ENTRAR aquí hasta tener: pain + impact + budget + decisionMaker + timeline.

=== OBJECIONES ANTICIPADAS ===
Si dicen "es caro":
  RESPONDER: "¿Caro comparado con qué?"
  LUEGO: "¿Cuánto te está costando hoy NO resolverlo?"

Si dicen "tengo que pensarlo":
  RESPONDER: "Te entiendo. ¿Qué parte concretamente te genera dudas?"

Si dicen "tengo que consultarlo con mi jefe":
  RESPONDER: "Tiene todo el sentido. ¿Te parece útil si organizamos 20 min con quien decide?"

Si dicen "no es el momento":
  RESPONDER: "Si lo dejas para más adelante, ¿el problema se resuelve solo o empeora?"

=== CLOSING ===
PREGUNTA: "Basado en lo que hemos hablado, ¿cómo te gustaría proceder?"
PREGUNTA: "¿Qué tendría que pasar a partir de aquí para que esto funcione para ti?"
NO cerrar duro. Que el prospect proponga el siguiente paso.

=== NEXT STEPS — debe quedar agendado antes de colgar ===
- Acción concreta: {{ej: enviar propuesta, demo técnica, reunión con decisor}}
- Fecha: {{fecha + hora}}
- Quién participa: {{nombres}}
- Qué llevo yo a esa reunión: {{material}}
- Qué traerá el prospect: {{información o decisión}}

=== NO HACER ===
- No mencionar precio antes de cuantificar dolor.
- No mostrar features sin que las haya pedido.
- No prometer fechas de implementación sin validar con delivery.
- No enviar propuesta sin tener al decisor en la sala.
```

---

## Ejemplo rellenado

Caso real: vendedor B2B SaaS de RRHH llamando a HR Manager de scaleup.

```
=== CONTEXTO ===
Prospect: María López (HR Manager)
Empresa: Acme Tech (SaaS B2B, 180 empleados)
Origen del lead: inbound desde webinar de retención
Llamadas previas: ninguna
Hipótesis de dolor: rotación alta de developers, exit interviews sin estructura
Hipótesis de valor: encuestas estructuradas + dashboard de señales tempranas
Objetivo de esta llamada: discovery + calificación

=== HOOK DE APERTURA ===
HOOK: "Antes de entrar en cómo trabajamos, ¿qué viste en el webinar que te hizo agendar?"

=== DISCOVERY ===
PREGUNTA: ¿Cuántos developers se fueron en los últimos 12 meses?
PREGUNTA: ¿Cómo gestionan hoy las señales de que alguien se va a ir?
PREGUNTA: ¿Qué les ha costado en términos de tiempo de contratación y onboarding?
PREGUNTA: ¿Han probado encuestas internas? ¿Qué pasó?

=== DOLORES ===
- Rotación 25%+ en developers seniors
- Exit interviews que no llegan a producto/decisión
- C-level pide métricas, RRHH no tiene dashboard

=== QUALIFICATION ===
PREGUNTA: ¿Quién aprueba este tipo de inversión — tú, dirección de personas o C-level?
PREGUNTA: ¿Han pensado un rango de inversión para resolver retención?
PREGUNTA: ¿Hay deadline interno — auditoría, board, OKR de Q3?

=== OBJECIONES ===
Si dicen "ya tenemos engagement survey":
  RESPONDER: "¿Y eso te da señales tempranas o sólo la foto trimestral?"

=== NEXT STEPS ===
- Demo técnica con CTO + Head of People
- Fecha: martes próximo 10:00
- Llevo: caso de Stripe + dashboard demo
- Traen: 3 KPIs de retención actuales
```

---

## Tips para que el coach lo aproveche

- **PREGUNTA:** y **HOOK:** son keywords que el coach reconoce mejor.
- Frases sueltas mejor que párrafos. El coach hace match línea a línea.
- Si tienes un caso de referencia ("Stripe vivió esto") ponlo en una línea sola con `CASO: ...`.
- Si tienes una métrica fuerte ("nuestros clientes reducen 40%") ponla con `STAT: ...`.
- Lo que pongas como `NO HACER:` el coach lo usa para detectar pitch prematuro o respuestas mal dirigidas.
