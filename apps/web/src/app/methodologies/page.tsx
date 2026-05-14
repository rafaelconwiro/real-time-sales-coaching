"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Methodology {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  currentVersion: number;
  createdAt: string;
}

export default function MethodologiesPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<Methodology[]>([]);
  const [ingestText, setIngestText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const ws = await api.defaultWorkspace();
        setWorkspaceId(ws.id);
        await refresh(ws.id);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  async function refresh(wsId: string) {
    const ms = (await api.listPlaybooks(wsId)) as Methodology[];
    setItems(ms);
  }

  async function action(fn: () => Promise<any>) {
    if (!workspaceId) return;
    try {
      await fn();
      await refresh(workspaceId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function ingest() {
    if (!workspaceId || !ingestText.trim()) return;
    setIngesting(true);
    setError(null);
    try {
      await api.ingestPlaybook(workspaceId, ingestText);
      setIngestText("");
      await refresh(workspaceId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-400 hover:text-accent">
          ← Inicio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Biblioteca de metodologias</h1>
      </header>

      {error && <div className="mb-4 rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</div>}

      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs uppercase tracking-wide text-slate-400">Ingerir desde documento / texto</h2>
        <textarea
          value={ingestText}
          onChange={(e) => setIngestText(e.target.value)}
          placeholder="Pega texto crudo describiendo la metodologia (NEPQ, MEDDIC, propia...). Gemini la estructura en stages + preguntas + objeciones + senales."
          className="mt-2 h-40 w-full rounded border border-border bg-background p-2 text-sm font-mono"
        />
        <button
          onClick={ingest}
          disabled={ingesting || !ingestText.trim()}
          className="mt-2 rounded bg-accent px-3 py-1 text-sm text-background hover:bg-teal-300 disabled:opacity-50"
        >
          {ingesting ? "Estructurando con Gemini..." : "Ingerir"}
        </button>
      </section>

      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/methodologies/${m.id}`} className="text-lg font-medium text-accent hover:underline">
                    {m.name}
                  </Link>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      m.status === "active"
                        ? "bg-accent/20 text-accent"
                        : m.status === "archived"
                          ? "bg-slate-700 text-slate-400"
                          : "bg-warn/20 text-warn"
                    }`}
                  >
                    {m.status}
                  </span>
                  <span className="text-xs text-slate-500">v{m.currentVersion}</span>
                </div>
                {m.description && <div className="mt-1 text-sm text-slate-400">{m.description}</div>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                {m.status !== "active" && (
                  <button
                    onClick={() => action(() => api.activatePlaybook(m.id))}
                    className="rounded border border-border bg-background px-2 py-1 hover:border-accent"
                  >
                    Activar
                  </button>
                )}
                {m.status !== "archived" && (
                  <button
                    onClick={() => action(() => api.archivePlaybook(m.id))}
                    className="rounded border border-border bg-background px-2 py-1 hover:border-danger hover:text-danger"
                  >
                    Archivar
                  </button>
                )}
                <button
                  onClick={() => action(() => api.duplicatePlaybook(m.id))}
                  className="rounded border border-border bg-background px-2 py-1 hover:border-accent"
                >
                  Duplicar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
