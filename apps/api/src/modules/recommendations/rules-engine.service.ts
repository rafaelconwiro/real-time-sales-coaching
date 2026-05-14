import { Injectable } from "@nestjs/common";
import type { LiveAnalysisResponse } from "@rtsc/shared";

interface PlaybookContext {
  stages: { name: string; order: number; requiredFields: string[] }[];
  objections: {
    name: string;
    detectionExamples: string[];
    recommendedResponse: string;
    recommendedQuestions: string[];
  }[];
}

const SELLER_PITCH_PATTERNS: RegExp[] = [
  /\bnuestra plataforma\b/i,
  /\bnuestro producto\b/i,
  /\bofrecemos\b/i,
  /\bte explico como funciona\b/i,
  /\bel precio es\b/i,
  /\bcuesta\s+\d/i,
  /\bcaracteristicas\b/i,
  /\bdemo\b.*\b(modulo|funcion)/i,
];

const SELLER_ANSWERING_PATTERNS: RegExp[] = [
  /^si,? /i,
  /^claro,? /i,
  /^exacto,? /i,
  /^correcto,? /i,
];

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  budget: [/presupuesto/i, /\bcoste\b/i, /\bprecio\b/i, /\beuros?\b/i, /\$\s?\d/, /\bcuesta\b/i],
  pain: [/problema/i, /dolor/i, /no funciona/i, /ineficiente/i, /perdemos/i, /tarda mucho/i],
  decisionMaker: [/decisor/i, /aprueba/i, /\bjefe\b/i, /director/i, /comite/i, /firma/i],
  timeline: [/cuando/i, /\bplazo\b/i, /\btrimestre\b/i, /\bq[1-4]\b/i, /antes de/i, /para\s+\w+/i],
  impact: [/impacto/i, /coste de oportunidad/i, /horas/i, /perdida/i, /facturacion/i],
};

const OBJECTION_KEYWORDS: Record<string, RegExp[]> = {
  price: [/caro/i, /\bprecio\b.*\balto/i, /no\s+podemos\s+pagar/i, /demasiado/i],
  timing: [/no es el momento/i, /mas adelante/i, /\bahora no\b/i, /el ano que viene/i],
  no_need: [/no lo necesitamos/i, /ya tenemos/i, /no es prioridad/i],
  competitor: [/estamos viendo/i, /comparando con/i, /tambien hablamos con/i, /alternativ/i],
};

const STAGE_BY_INDEX: Record<number, string> = {
  0: "opening",
  1: "discovery",
  2: "qualification",
  3: "solution_framing",
  4: "objection_handling",
  5: "closing",
  6: "next_steps",
};

@Injectable()
export class RulesEngineService {
  detectPrematurePitch(input: {
    sellerText: string;
    stage: string;
    knownFields: Record<string, string | null>;
    requiredEarlyFields: string[];
  }): { reason: string; phrase: string } | null {
    const lower = input.sellerText.toLowerCase();
    const pitching = SELLER_PITCH_PATTERNS.some((p) => p.test(lower));
    if (!pitching) return null;
    if (input.stage === "solution_framing" || input.stage === "closing" || input.stage === "next_steps") {
      return null;
    }
    const missingEarly = input.requiredEarlyFields.filter((f) => !input.knownFields[f]);
    if (missingEarly.length === 0) return null;
    return {
      reason: `Pitch antes de descubrir: faltan ${missingEarly.join(", ")}`,
      phrase: `Antes de entrar en como lo resolveriamos, ¿podrias contarme un poco mas sobre ${missingEarly[0]}?`,
    };
  }

  detectAnsweringInsteadOfAsking(sellerText: string): { reason: string; phrase: string } | null {
    if (!SELLER_ANSWERING_PATTERNS.some((p) => p.test(sellerText))) return null;
    if (sellerText.includes("?")) return null;
    if (sellerText.length < 60) return null;
    return {
      reason: "Respondiendo afirmando en vez de devolver pregunta",
      phrase: "¿Que te hace preguntar eso?",
    };
  }

  analyze(
    recentText: string,
    playbook: PlaybookContext,
    currentStage: string,
  ): LiveAnalysisResponse {
    const lower = recentText.toLowerCase();
    const detectedSignals: LiveAnalysisResponse["detectedSignals"] = [];
    const knownFields: Record<string, string | null> = {};

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const p of patterns) {
        const match = recentText.match(p);
        if (match) {
          knownFields[field] = match[0];
          break;
        }
      }
    }

    for (const [label, patterns] of Object.entries(OBJECTION_KEYWORDS)) {
      for (const p of patterns) {
        const m = recentText.match(p);
        if (m) {
          detectedSignals.push({
            type: "objection",
            label,
            confidence: 0.7,
            evidence: m[0],
          });
          break;
        }
      }
    }

    if (/comprar|firmar|empezar|cuando empezamos|listo/i.test(lower)) {
      detectedSignals.push({
        type: "buying_signal",
        label: "ready_to_move",
        confidence: 0.7,
        evidence: "intencion explicita de avance",
      });
    }

    let stage = currentStage as LiveAnalysisResponse["stage"];
    const objectionDetected = detectedSignals.some((s) => s.type === "objection");
    const buyingDetected = detectedSignals.some((s) => s.type === "buying_signal");
    if (objectionDetected) stage = "objection_handling";
    else if (buyingDetected) stage = "closing";
    else if (currentStage === "opening" && Object.keys(knownFields).length > 0)
      stage = "discovery";

    const allRequired = Array.from(
      new Set(playbook.stages.flatMap((s) => s.requiredFields)),
    );
    const missingFields = allRequired.filter((f) => !knownFields[f]);

    let recommendation: LiveAnalysisResponse["recommendation"] = null;
    const priceObjection = detectedSignals.find(
      (s) => s.type === "objection" && s.label === "price",
    );
    if (priceObjection) {
      const playbookObj = playbook.objections.find((o) => /precio|price|caro/i.test(o.name));
      recommendation = {
        type: "objection_response",
        title: "Objecion de precio",
        message:
          playbookObj?.recommendedResponse ??
          "No justifiques precio aun. Pregunta contra que alternativa lo comparan.",
        suggestedPhrase:
          playbookObj?.recommendedQuestions?.[0] ??
          "Cuando dices que lo ves caro, ¿comparado con que alternativa o coste actual lo estas midiendo?",
        priority: "high",
        reason: "Detectada objecion de precio sin contexto comparativo",
      };
    } else if (missingFields.length > 0 && stage !== "closing") {
      const next = missingFields[0];
      const phraseByField: Record<string, string> = {
        pain: "¿Que problema concreto te llevo a buscar esto ahora?",
        impact: "¿Que coste o impacto tiene mantener esto otros 6 meses?",
        budget: "¿Hay un rango de inversion definido para este problema?",
        decisionMaker: "Ademas de ti, ¿quien participa en la decision final?",
        timeline: "¿Para cuando necesitarian tener esto funcionando?",
      };
      recommendation = {
        type: "question",
        title: `Falta ${next}`,
        message: `No avances todavia. Descubre ${next} antes de cualquier propuesta.`,
        suggestedPhrase: phraseByField[next] ?? `¿Puedes contarme mas sobre ${next}?`,
        priority: "medium",
        reason: `Campo requerido ${next} sin descubrir`,
      };
    }

    return {
      stage,
      reason: undefined,
      detectedSignals,
      knownFields,
      missingFields,
      recommendation,
    };
  }
}
