"use client";

import type { StageName } from "@rtsc/shared";

const STAGE_LABELS: Record<StageName, string> = {
  opening: "Apertura",
  discovery: "Discovery",
  qualification: "Calificacion",
  solution_framing: "Encaje de solucion",
  objection_handling: "Manejo de objeciones",
  closing: "Cierre",
  next_steps: "Proximos pasos",
};

const STAGE_GOALS: Record<StageName, string> = {
  opening: "Romper hielo, alinear agenda.",
  discovery: "Entender dolor e impacto.",
  qualification: "Validar presupuesto, decisor y timeline.",
  solution_framing: "Conectar dolor con propuesta.",
  objection_handling: "Resolver objeciones con preguntas.",
  closing: "Pedir avance claro.",
  next_steps: "Confirmar accion, fecha y owner.",
};

export function CurrentStageCard({ stage }: { stage: StageName }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">Etapa actual</div>
      <div className="mt-1 text-xl font-semibold text-accent">{STAGE_LABELS[stage]}</div>
      <div className="mt-1 text-sm text-slate-400">{STAGE_GOALS[stage]}</div>
    </div>
  );
}
