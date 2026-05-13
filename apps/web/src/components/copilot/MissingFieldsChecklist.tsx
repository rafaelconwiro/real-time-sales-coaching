"use client";

const FIELD_LABELS: Record<string, string> = {
  pain: "Dolor",
  impact: "Impacto",
  budget: "Presupuesto",
  decisionMaker: "Decisor",
  timeline: "Timeline",
};

export function MissingFieldsChecklist({
  knownFields,
  missingFields,
}: {
  knownFields: Record<string, string | null>;
  missingFields: string[];
}) {
  const allFields = Array.from(
    new Set([...Object.keys(knownFields), ...missingFields]),
  );
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">Discovery checklist</div>
      <ul className="mt-2 space-y-1 text-sm">
        {allFields.map((field) => {
          const found = !!knownFields[field];
          return (
            <li key={field} className="flex items-center justify-between gap-3">
              <span className={found ? "text-slate-200" : "text-slate-400"}>
                {FIELD_LABELS[field] ?? field}
              </span>
              <span
                className={
                  found
                    ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300"
                    : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
                }
              >
                {found ? "ok" : "falta"}
              </span>
            </li>
          );
        })}
        {allFields.length === 0 && (
          <li className="text-sm text-slate-500">Sin campos requeridos.</li>
        )}
      </ul>
    </div>
  );
}
