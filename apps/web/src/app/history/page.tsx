"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface SessionRow {
  id: string;
  title: string | null;
  prospectName: string | null;
  prospectCompany: string | null;
  channel: string;
  tag: string | null;
  status: string;
  language: string;
  createdAt: string;
  methodology?: { id: string; name: string } | null;
  score?: { overallScore: number } | null;
  _count: { segments: number; signals: number; recommendations: number };
}

const TAGS = ["", "won", "lost", "follow_up"] as const;

export default function HistoryPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("");
  const [methodologies, setMethodologies] = useState<{ id: string; name: string }[]>([]);
  const [methodologyId, setMethodologyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const ws = await api.defaultWorkspace();
        setWorkspaceId(ws.id);
        const methods = await api.listPlaybooks(ws.id);
        setMethodologies(methods.map((m: any) => ({ id: m.id, name: m.name })));
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    void api
      .listSessions({
        workspaceId,
        search: search.trim() || undefined,
        tag: tag || undefined,
        methodologyId: methodologyId || undefined,
      })
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [workspaceId, search, tag, methodologyId]);

  const totalsByTag = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.tag) map.set(s.tag, (map.get(s.tag) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-400 hover:text-accent">
          ← Inicio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Historial</h1>
        <p className="text-sm text-slate-400">
          {sessions.length} sesiones · {totalsByTag.get("won") ?? 0} won · {totalsByTag.get("lost") ?? 0} lost ·{" "}
          {totalsByTag.get("follow_up") ?? 0} follow_up
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en titulo, prospect o transcripcion..."
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-slate-100"
        >
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t === "" ? "Todos los tags" : t}
            </option>
          ))}
        </select>
        <select
          value={methodologyId}
          onChange={(e) => setMethodologyId(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Todas las metodologias</option>
          {methodologies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mt-4 rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</div>}

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Titulo</th>
              <th className="px-3 py-2">Prospect</th>
              <th className="px-3 py-2">Metodologia</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Tag</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Stats</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Sin sesiones que coincidan.
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-surface/60">
                <td className="px-3 py-2 text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/session/${s.id}`} className="text-accent hover:underline">
                    {s.title ?? "(sin titulo)"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.prospectName ?? "—"}
                  {s.prospectCompany ? ` · ${s.prospectCompany}` : ""}
                </td>
                <td className="px-3 py-2 text-xs">{s.methodology?.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.channel}</td>
                <td className="px-3 py-2">
                  <TagPicker
                    sessionId={s.id}
                    value={s.tag}
                    onChange={(t) => {
                      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, tag: t } : x)));
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  {s.score ? <span className="font-mono">{s.score.overallScore}</span> : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {s._count.segments} seg · {s._count.signals} sig · {s._count.recommendations} rec
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function TagPicker({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string;
  value: string | null;
  onChange: (t: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={async (e) => {
        const v = e.target.value || null;
        onChange(v);
        try {
          await api.setTag(sessionId, v);
        } catch {
          // ignore
        }
      }}
      className="rounded border border-border bg-background px-1 py-0.5 text-xs"
    >
      <option value="">—</option>
      <option value="won">won</option>
      <option value="lost">lost</option>
      <option value="follow_up">follow_up</option>
    </select>
  );
}
