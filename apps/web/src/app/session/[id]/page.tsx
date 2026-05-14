"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Session {
  id: string;
  title: string | null;
  channel: string;
  language: string;
  tag: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  prospectName: string | null;
  prospectCompany: string | null;
  methodology?: {
    id: string;
    name: string;
    stages: { id: string; name: string; order: number; goal: string; exitCriteria: string | null }[];
  } | null;
  segments: { id: string; speaker: string; text: string; createdAt: string }[];
  signals: { id: string; type: string; label: string; confidence: number; evidence: string; createdAt: string }[];
  recommendations: {
    id: string;
    type: string;
    title: string;
    message: string;
    suggestedPhrase: string | null;
    priority: string;
    reason: string;
    createdAt: string;
  }[];
  score?: {
    overallScore: number;
    discoveryScore: number;
    qualificationScore: number;
    objectionScore: number;
    closingScore: number;
    methodologyAdherence: number;
    missingFields: string[];
    strengths: string[];
    improvements: string[];
    executiveSummary: string | null;
    suggestedEmail: string | null;
  } | null;
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [session, setSession] = useState<Session | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [comparativa, setComparativa] = useState<any[]>([]);
  const [tab, setTab] = useState<"summary" | "replay" | "transcript">("summary");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [s, h] = await Promise.all([api.getSession(id), api.highlights(id)]);
        setSession(s);
        setHighlights(h);
        const ws = await api.defaultWorkspace();
        const cmp = await api.comparative(ws.id, 10);
        setComparativa(cmp);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [id]);

  const replayEvents = useMemo(() => {
    if (!session) return [];
    const startMs = session.segments[0]
      ? new Date(session.segments[0].createdAt).getTime()
      : new Date(session.createdAt).getTime();
    const events: Array<{ at: number; kind: string; payload: any }> = [];
    for (const seg of session.segments)
      events.push({ at: new Date(seg.createdAt).getTime() - startMs, kind: "segment", payload: seg });
    for (const sig of session.signals)
      events.push({ at: new Date(sig.createdAt).getTime() - startMs, kind: "signal", payload: sig });
    for (const rec of session.recommendations)
      events.push({ at: new Date(rec.createdAt).getTime() - startMs, kind: "recommendation", payload: rec });
    return events.sort((a, b) => a.at - b.at);
  }, [session]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-danger">{error}</main>
    );
  }
  if (!session) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-slate-500">Cargando...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <Link href="/history" className="text-xs text-slate-400 hover:text-accent">
          ← Historial
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{session.title ?? "Sesion"}</h1>
        <p className="text-sm text-slate-400">
          {session.prospectName ? `${session.prospectName} · ` : ""}
          {session.prospectCompany ?? ""}
          {" · "}
          {session.channel} · {session.language} ·{" "}
          {session.methodology?.name ?? "sin metodologia"}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <button
            onClick={() => setTab("summary")}
            className={tab === "summary" ? "text-accent" : "text-slate-400"}
          >
            Resumen
          </button>
          <button
            onClick={() => setTab("replay")}
            className={tab === "replay" ? "text-accent" : "text-slate-400"}
          >
            Replay
          </button>
          <button
            onClick={() => setTab("transcript")}
            className={tab === "transcript" ? "text-accent" : "text-slate-400"}
          >
            Transcript
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={api.transcriptUrl(id)}
              className="rounded-md border border-border bg-surface px-3 py-1 text-xs hover:border-accent"
            >
              Descargar .txt
            </a>
            <a
              href={api.exportJsonUrl(id)}
              className="rounded-md border border-border bg-surface px-3 py-1 text-xs hover:border-accent"
            >
              Descargar JSON completo
            </a>
            <button
              onClick={async () => {
                try {
                  const summary = await api.reanalyze(id);
                  if (!summary) return;
                  const flat = {
                    overallScore: summary.score?.overallScore ?? 0,
                    discoveryScore: summary.score?.discoveryScore ?? 0,
                    qualificationScore: summary.score?.qualificationScore ?? 0,
                    objectionScore: summary.score?.objectionScore ?? 0,
                    closingScore: summary.score?.closingScore ?? 0,
                    methodologyAdherence: summary.score?.methodologyAdherence ?? 0,
                    strengths: summary.score?.strengths ?? [],
                    improvements: summary.score?.improvements ?? [],
                    missingFields: summary.missingFields ?? [],
                    executiveSummary: summary.executiveSummary ?? null,
                    suggestedEmail: summary.suggestedEmail ?? null,
                  };
                  setSession((prev) => (prev ? { ...prev, score: flat } : prev));
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
              className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent hover:bg-accent/20"
            >
              Re-analizar con IA
            </button>
          </div>
        </div>
      </header>

      {tab === "summary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {session.score ? (
              <>
                <Card title={`Score ${session.score.overallScore}`}>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Metric label="Discovery" v={session.score.discoveryScore} />
                    <Metric label="Qualif." v={session.score.qualificationScore} />
                    <Metric label="Objec." v={session.score.objectionScore} />
                    <Metric label="Closing" v={session.score.closingScore} />
                    <Metric label="Adher." v={session.score.methodologyAdherence} />
                  </div>
                </Card>
                {session.score.executiveSummary && (
                  <Card title="Resumen ejecutivo">{session.score.executiveSummary}</Card>
                )}
                <Card title="Fortalezas">
                  <ul className="list-disc pl-4 text-sm text-slate-300">
                    {session.score.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </Card>
                <Card title="Mejoras">
                  <ul className="list-disc pl-4 text-sm text-slate-300">
                    {session.score.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </Card>
                {session.score.missingFields.length > 0 && (
                  <Card title="Info que falto">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {session.score.missingFields.map((f) => (
                        <span key={f} className="rounded border border-danger/50 bg-danger/10 px-2 py-0.5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}
                {session.score.suggestedEmail && (
                  <Card title="Email de follow-up sugerido">
                    <pre className="whitespace-pre-wrap text-sm text-slate-300">{session.score.suggestedEmail}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(session.score!.suggestedEmail ?? "")}
                      className="mt-2 rounded border border-border bg-background px-2 py-1 text-xs hover:border-accent"
                    >
                      Copiar
                    </button>
                  </Card>
                )}
              </>
            ) : (
              <Card title="Score">Aun sin scoring (sesion en curso o sin segmentos).</Card>
            )}
          </div>
          <aside className="space-y-4">
            <Card title="Highlights">
              {highlights.length === 0 ? (
                <div className="text-sm text-slate-500">Sin highlights.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {highlights.map((h, i) => (
                    <li key={i} className="border-l-2 border-accent pl-2">
                      <div className="text-xs text-slate-500">{formatMs(h.offsetMs)}</div>
                      <div className="font-medium">{h.label}</div>
                      <div className="text-xs text-slate-400">{h.evidence}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Comparativa (10 ultimas)">
              <ComparativaChart data={comparativa} currentId={id} />
            </Card>
          </aside>
        </div>
      )}

      {tab === "replay" && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-4 text-xs text-slate-500">
            {replayEvents.length} eventos en linea de tiempo. Click un evento para detalle.
          </div>
          <ol className="space-y-1 text-sm">
            {replayEvents.map((e, idx) => (
              <li key={idx} className="grid grid-cols-[60px_80px_1fr] gap-2 border-t border-border py-1">
                <span className="text-xs text-slate-500">{formatMs(e.at)}</span>
                <span
                  className={`text-xs ${
                    e.kind === "segment"
                      ? "text-slate-300"
                      : e.kind === "signal"
                        ? "text-warn"
                        : "text-accent"
                  }`}
                >
                  {e.kind}
                </span>
                <span className="text-sm">
                  {e.kind === "segment" && `${e.payload.speaker}: ${e.payload.text}`}
                  {e.kind === "signal" && `${e.payload.type} · ${e.payload.label} (${Math.round(e.payload.confidence * 100)}%)`}
                  {e.kind === "recommendation" && `${e.payload.title} — ${e.payload.suggestedPhrase ?? e.payload.message}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "transcript" && (
        <div className="rounded-lg border border-border bg-surface p-4">
          {session.segments.length === 0 ? (
            <div className="text-sm text-slate-500">Sin transcripcion.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {session.segments.map((s) => (
                <div key={s.id}>
                  <span
                    className={s.speaker === "seller" ? "font-mono text-accent" : "font-mono text-sky-300"}
                  >
                    {s.speaker}:
                  </span>{" "}
                  <span className="text-slate-200">{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-slate-400">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Metric({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono text-lg">{v}</div>
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function ComparativaChart({ data, currentId }: { data: any[]; currentId: string }) {
  if (data.length === 0)
    return <div className="text-sm text-slate-500">Aun sin historial.</div>;
  const max = Math.max(...data.map((d) => d.score?.overallScore ?? 0), 100);
  return (
    <ul className="space-y-1 text-xs">
      {data.map((d) => {
        const v = d.score?.overallScore ?? 0;
        const pct = (v / max) * 100;
        const isCurrent = d.id === currentId;
        return (
          <li key={d.id} className="grid grid-cols-[80px_1fr_30px] items-center gap-1">
            <span className="truncate text-slate-500">
              {new Date(d.createdAt).toLocaleDateString()}
            </span>
            <div className="h-2 rounded bg-background">
              <div
                style={{ width: `${pct}%` }}
                className={`h-full rounded ${isCurrent ? "bg-accent" : "bg-slate-500"}`}
              />
            </div>
            <span className="text-right font-mono">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}
