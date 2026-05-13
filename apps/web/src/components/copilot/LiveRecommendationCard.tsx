"use client";

import type { LiveRecommendationPayload } from "@rtsc/shared";

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-danger/40 bg-danger/5",
  medium: "border-amber-400/30 bg-amber-400/5",
  low: "border-border bg-surface",
};

export function LiveRecommendationCard({
  recommendation,
}: {
  recommendation: LiveRecommendationPayload | null;
}) {
  if (!recommendation) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">Recomendacion</div>
        <div className="mt-2 text-sm text-slate-500">
          Sin recomendacion activa. Sigue indagando.
        </div>
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border p-4 ${PRIORITY_STYLES[recommendation.priority] ?? PRIORITY_STYLES.low}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {recommendation.type.replace("_", " ")} · {recommendation.priority}
        </div>
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{recommendation.title}</div>
      <div className="mt-2 text-sm text-slate-300">{recommendation.message}</div>
      {recommendation.suggestedPhrase && (
        <blockquote className="mt-3 rounded border-l-2 border-accent bg-background/40 px-3 py-2 text-sm italic text-slate-200">
          &ldquo;{recommendation.suggestedPhrase}&rdquo;
        </blockquote>
      )}
      <div className="mt-2 text-xs text-slate-500">{recommendation.reason}</div>
    </div>
  );
}
