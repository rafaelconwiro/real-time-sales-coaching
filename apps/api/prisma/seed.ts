import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "demo-workspace" },
    update: {},
    create: { id: "demo-workspace", name: "Demo Workspace" },
  });

  await prisma.user.upsert({
    where: { email: "demo@salescoach.dev" },
    update: {},
    create: {
      id: "demo-user",
      workspaceId: workspace.id,
      name: "Vendedor Demo",
      email: "demo@salescoach.dev",
      role: "seller",
    },
  });

  const existingNepq = await prisma.salesMethodology.findFirst({
    where: { workspaceId: workspace.id, name: "NEPQ+ (Jeremy Miner)" },
  });
  if (!existingNepq) {
    await seedNepqPlus(workspace.id);
  } else {
    console.log("NEPQ+ already seeded.");
  }

  const existing = await prisma.salesMethodology.findFirst({
    where: { workspaceId: workspace.id, name: "Discovery B2B Consultivo" },
  });
  if (existing) {
    console.log("Discovery B2B already seeded.");
    return;
  }

  const methodology = await prisma.salesMethodology.create({
    data: {
      workspaceId: workspace.id,
      name: "Discovery B2B Consultivo",
      description: "Metodologia base para discovery consultivo en software B2B.",
      status: "active",
      rawContent: "Discovery → Qualification → Solution Framing → Objection Handling → Closing",
      stages: {
        create: [
          {
            name: "opening",
            order: 0,
            goal: "Romper hielo, alinear agenda y obtener permiso para indagar.",
            exitCriteria: "Cliente acepta agenda y comparte contexto inicial.",
            requiredFields: [],
            questions: {
              create: [
                {
                  question:
                    "Antes de empezar, ¿que esperabas obtener de esta conversacion?",
                  purpose: "Alinear expectativas",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "discovery",
            order: 1,
            goal: "Entender dolor, impacto, situacion actual y stakeholders.",
            exitCriteria: "Identificado al menos un dolor cuantificado.",
            requiredFields: ["pain", "impact"],
            questions: {
              create: [
                {
                  question: "¿Cual es el problema que te llevo a buscar una solucion ahora?",
                  purpose: "Identificar pain",
                  priority: "high",
                },
                {
                  question: "¿Que coste tiene mantener esto otros 6 meses?",
                  purpose: "Cuantificar impacto",
                  priority: "high",
                },
                {
                  question: "¿Como resuelven esto hoy?",
                  purpose: "Situacion actual",
                  priority: "medium",
                },
              ],
            },
          },
          {
            name: "qualification",
            order: 2,
            goal: "Validar presupuesto, decisor, timeline y autoridad.",
            exitCriteria: "Conocido decisor, rango de inversion y fecha objetivo.",
            requiredFields: ["budget", "decisionMaker", "timeline"],
            questions: {
              create: [
                {
                  question: "¿Hay un rango de inversion definido para resolver esto?",
                  purpose: "Budget",
                  priority: "high",
                },
                {
                  question: "Ademas de ti, ¿quien participa en la decision final?",
                  purpose: "Decision maker",
                  priority: "high",
                },
                {
                  question: "¿Para cuando necesitarian tener esto funcionando?",
                  purpose: "Timeline",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "solution_framing",
            order: 3,
            goal: "Conectar dolor con propuesta de valor especifica.",
            exitCriteria: "Cliente confirma encaje funcional principal.",
            requiredFields: [],
            questions: { create: [] },
          },
          {
            name: "objection_handling",
            order: 4,
            goal: "Resolver objeciones explicitas con preguntas y argumentos del playbook.",
            exitCriteria: "Objeciones principales reconocidas o resueltas.",
            requiredFields: [],
            questions: { create: [] },
          },
          {
            name: "closing",
            order: 5,
            goal: "Pedir avance claro: propuesta, prueba o decision.",
            exitCriteria: "Cliente acepta proximo paso concreto con fecha.",
            requiredFields: [],
            questions: { create: [] },
          },
          {
            name: "next_steps",
            order: 6,
            goal: "Confirmar acciones, fechas y owners.",
            exitCriteria: "Proximo paso agendado.",
            requiredFields: [],
            questions: { create: [] },
          },
        ],
      },
      objections: {
        create: [
          {
            name: "price",
            detectionExamples: ["es caro", "precio alto", "no podemos pagar", "demasiado"],
            recommendedResponse:
              "No justifiques el precio. Pregunta contra que alternativa lo comparan e identifica el coste de no resolverlo.",
            recommendedQuestions: [
              "Cuando dices que lo ves caro, ¿comparado con que alternativa o coste actual lo estas midiendo?",
              "¿Que valor tendria resolver esto en los proximos 3 meses?",
            ],
          },
          {
            name: "timing",
            detectionExamples: ["no es el momento", "mas adelante", "ahora no"],
            recommendedResponse:
              "Reconoce el timing y cuantifica el coste de retrasar. Identifica el trigger real que activara la decision.",
            recommendedQuestions: [
              "¿Que tendria que pasar para que esto si fuera prioridad?",
              "¿Que coste tiene mantener la situacion actual otros 6 meses?",
            ],
          },
          {
            name: "no_need",
            detectionExamples: ["no lo necesitamos", "ya tenemos", "no es prioridad"],
            recommendedResponse:
              "No empujes. Vuelve al dolor: pregunta como gestionan el problema hoy y que coste tiene.",
            recommendedQuestions: [
              "¿Como resuelven esto hoy y cuanto tiempo les consume?",
              "¿Que pasaria si lo resolvieran en una semana en vez de en meses?",
            ],
          },
        ],
      },
      signals: {
        create: [
          {
            type: "buying_signal",
            name: "ready_to_move",
            detectionExamples: ["cuando empezamos", "queremos firmar", "listos para probar"],
            recommendedAction: "Avanzar a closing: proponer proximo paso con fecha clara.",
          },
          {
            type: "risk_signal",
            name: "no_decision_maker_in_call",
            detectionExamples: ["tengo que consultarlo", "mi jefe decide"],
            recommendedAction: "Pedir reunion con decisor antes de enviar propuesta.",
          },
          {
            type: "competitor",
            name: "evaluating_alternatives",
            detectionExamples: ["estamos viendo", "tambien hablamos con"],
            recommendedAction: "Preguntar criterios de evaluacion y diferenciar sin atacar.",
          },
        ],
      },
    },
  });

  console.log(`Seeded methodology: ${methodology.id}`);
}

async function seedNepqPlus(workspaceId: string) {
  const methodology = await prisma.salesMethodology.create({
    data: {
      workspaceId,
      name: "NEPQ+ (Jeremy Miner)",
      description:
        "Neuro Emotional Persuasion Questioning. Vender desde curiosidad neutra, indagar consecuencias emocionales del problema, dejar que el prospect se convenza solo.",
      status: "active",
      rawContent:
        "Connection → Engagement → Transition → Presentation → Commitment. Objeciones se manejan con Clarify → Discuss → Diffuse.",
      stages: {
        create: [
          {
            name: "opening",
            order: 0,
            goal: "Conexion neutra. Postura no necesitada. Pregunta primero, contexto del prospect.",
            exitCriteria: "Prospect comparte por que esta interesado / accede a contar su situacion.",
            requiredFields: [],
            questions: {
              create: [
                {
                  question: "¿Que te llevo a aceptar esta reunion?",
                  purpose: "Detectar motivacion real",
                  priority: "high",
                },
                {
                  question: "¿Que esperabas conseguir de esta conversacion?",
                  purpose: "Alinear expectativas",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "discovery",
            order: 1,
            goal: "Engagement: situation + problem awareness questions. Hacer consciente el dolor.",
            exitCriteria: "Prospect verbaliza el problema con sus palabras y se nota incomodidad emocional.",
            requiredFields: ["pain", "currentSolution"],
            questions: {
              create: [
                {
                  question: "¿Como lo estais haciendo actualmente?",
                  purpose: "Situation question",
                  priority: "high",
                },
                {
                  question: "¿Que es lo que mas te frustra de la situacion actual?",
                  purpose: "Problem awareness emocional",
                  priority: "high",
                },
                {
                  question: "¿Hace cuanto que tienes este problema?",
                  purpose: "Duracion del dolor",
                  priority: "medium",
                },
                {
                  question: "¿Que has intentado para resolverlo?",
                  purpose: "Validar intentos fallidos",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "qualification",
            order: 2,
            goal: "Transition: consequence questions. Que el prospect cuantifique impacto + identificar decisor/presupuesto/timeline.",
            exitCriteria: "Prospect dice 'tenemos que resolver esto' o equivalente. Conocido decisor + rango + plazo.",
            requiredFields: ["consequence", "budget", "decisionMaker", "timeline"],
            questions: {
              create: [
                {
                  question: "¿Que pasa si no resuelves esto en los proximos 6 meses?",
                  purpose: "Consecuencia futura",
                  priority: "high",
                },
                {
                  question: "¿Cuanto te esta costando esto realmente al ano?",
                  purpose: "Cuantificar impacto",
                  priority: "high",
                },
                {
                  question: "Ademas de ti, ¿quien mas tendria que estar de acuerdo para avanzar?",
                  purpose: "Decision maker",
                  priority: "high",
                },
                {
                  question: "¿Para cuando necesitarian tener esto funcionando?",
                  purpose: "Timeline",
                  priority: "high",
                },
                {
                  question: "¿Habeis asignado presupuesto para resolverlo?",
                  purpose: "Budget",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "solution_framing",
            order: 3,
            goal: "Presentation: solucion conectada uno-a-uno con el dolor que ELLOS describieron. Sin discurso generico.",
            exitCriteria: "Prospect confirma que el encaje resuelve SU problema especifico.",
            requiredFields: [],
            questions: {
              create: [
                {
                  question: "Dado lo que me has contado, ¿como te sentirias si pudieras resolver X en Y semanas?",
                  purpose: "Future pacing emocional",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "objection_handling",
            order: 4,
            goal: "Objeciones con Clarify (devolver pregunta) → Discuss (que la nombren) → Diffuse (neutralizar sin defender).",
            exitCriteria: "Objecion principal verbalizada y reducida sin postura defensiva.",
            requiredFields: [],
            questions: { create: [] },
          },
          {
            name: "closing",
            order: 5,
            goal: "Commitment questions. NO cerrar duro. Que el prospect pida el siguiente paso.",
            exitCriteria: "Prospect propone o acepta proximo paso concreto.",
            requiredFields: [],
            questions: {
              create: [
                {
                  question: "Basado en lo que hemos hablado, ¿como te gustaria proceder?",
                  purpose: "Commitment question pasiva",
                  priority: "high",
                },
                {
                  question: "¿Que tendria que pasar a partir de aqui para que esto funcione para ti?",
                  purpose: "Auto-cierre",
                  priority: "high",
                },
              ],
            },
          },
          {
            name: "next_steps",
            order: 6,
            goal: "Confirmar accion + fecha + owner. Eliminar ambiguedad.",
            exitCriteria: "Proximo paso agendado con fecha y participantes claros.",
            requiredFields: [],
            questions: { create: [] },
          },
        ],
      },
      objections: {
        create: [
          {
            name: "price",
            detectionExamples: ["es caro", "no podemos pagar", "demasiado", "fuera de presupuesto"],
            recommendedResponse:
              "Clarify-Discuss-Diffuse. NO justificar precio. Devolver: '¿caro comparado con que?' y reconectar con el coste de no resolverlo.",
            recommendedQuestions: [
              "Cuando dices que es caro, ¿caro comparado con que?",
              "¿Que pasa si no lo resuelves y este problema continua otros 12 meses?",
              "Si tuvieras la garantia de que esto resuelve X, ¿el precio seguiria siendo el problema?",
            ],
          },
          {
            name: "timing",
            detectionExamples: ["no es el momento", "mas adelante", "tenemos otras prioridades"],
            recommendedResponse:
              "Devolver con curiosidad neutra. ¿Que tendria que pasar para que SI fuera el momento? Cuantificar coste de retrasar.",
            recommendedQuestions: [
              "Si lo dejas para mas adelante, ¿el problema desaparece solo o empeora?",
              "¿Cuanto te esta costando hoy NO resolverlo?",
            ],
          },
          {
            name: "need_to_think",
            detectionExamples: ["tengo que pensarlo", "dejame consultarlo", "te digo algo"],
            recommendedResponse:
              "Clarify: ¿que parte concretamente quieres pensar? Suele esconder duda no verbalizada. Sacarla a la luz.",
            recommendedQuestions: [
              "Te entiendo. ¿Que parte concretamente te genera dudas?",
              "¿Que informacion adicional te ayudaria a tomar la decision?",
            ],
          },
          {
            name: "no_decision_maker",
            detectionExamples: ["tengo que consultarlo con mi jefe", "no decido yo", "comite"],
            recommendedResponse:
              "Pedir reunion con decisor antes de propuesta. No enviar propuesta a black box.",
            recommendedQuestions: [
              "¿Como funcionan normalmente este tipo de decisiones en tu empresa?",
              "¿Te parece util si organizamos una sesion de 20 minutos con quien decide?",
            ],
          },
        ],
      },
      signals: {
        create: [
          {
            type: "buying_signal",
            name: "self_close",
            detectionExamples: ["¿como empezamos?", "¿cuando podemos arrancar?", "me gusta como suena"],
            recommendedAction: "El prospect se autocierra. NO sobrevender. Pasar directo a commitment + siguiente paso.",
          },
          {
            type: "buying_signal",
            name: "verbalized_pain",
            detectionExamples: ["es que esto nos esta matando", "estamos perdiendo dinero por esto", "no podemos seguir asi"],
            recommendedAction: "Profundizar emocion. '¿Y como te hace sentir eso?' Anclar dolor antes de presentar.",
          },
          {
            type: "risk_signal",
            name: "evasion",
            detectionExamples: ["no se", "depende", "ya veremos"],
            recommendedAction: "Prospect evade. No empujar. Reformular pregunta de forma mas concreta o cambiar angulo.",
          },
          {
            type: "competitor",
            name: "evaluating_alternatives",
            detectionExamples: ["tambien estamos viendo", "comparando con", "tengo otra propuesta"],
            recommendedAction: "Preguntar criterios sin atacar competidor. ¿Que es lo mas importante en tu evaluacion?",
          },
          {
            type: "missing_info",
            name: "vague_problem",
            detectionExamples: ["es que es complicado", "muchas cosas", "todo en general"],
            recommendedAction: "Forzar especificidad. '¿Cual de todas es la que mas te duele HOY?'",
          },
        ],
      },
    },
  });

  console.log(`Seeded NEPQ+ methodology: ${methodology.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
