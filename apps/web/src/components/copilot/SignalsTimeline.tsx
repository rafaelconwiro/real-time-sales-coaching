"use client";

import type { DetectedSignalPayload } from "@rtsc/shared";

const TYPE_COLOR: Record<string, string> = {
  buying_signal: "text-emerald-300",
  risk_signal: "text-rose-300",
  objection: "text-amber-300",
  missing_info: "text-slate-300",
  competitor: "text-sky-300",
  urgency: "text-fuchsia-300",
  budget: "text-amber-300",
};

export function SignalsTimeline({ signals }: { signals: DetectedSignalPayload[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">Senales detectadas</div>
      <ul className="mt-2 space-y-2 text-sm">
        {signals
          .slice(-6)
          .reverse()
          .map((s) => (
            <li key={s.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className={TYPE_COLOR[s.type] ?? "text-slate-300"}>
                  {s.type} · {s.label}
                </span>
                <span className="text-xs text-slate-500">
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>
              {s.evidence && (
                <div className="text-xs text-slate-500">&ldquo;{s.evidence}&rdquo;</div>
              )}
            </li>
          ))}
        {signals.length === 0 && (
          <li className="text-sm text-slate-500">Aun sin senales.</li>
        )}
      </ul>
    </div>
  );
}
