"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Methodology {
  id: string;
  name: string;
  status: string;
}
interface Prospect {
  id: string;
  name: string;
  company: string | null;
  notes: string | null;
}
interface PrecallConfig {
  methodologyId: string | null;
  prospectId: string | null;
  language: "es" | "en";
  script: string;
  prospectName: string;
  prospectCompany: string;
  prospectNotes: string;
}

const DEFAULT: PrecallConfig = {
  methodologyId: null,
  prospectId: null,
  language: "es",
  script: "",
  prospectName: "",
  prospectCompany: "",
  prospectNotes: "",
};

export default function Home() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [config, setConfig] = useState<PrecallConfig>(DEFAULT);
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const ws = await api.defaultWorkspace();
        setWorkspaceId(ws.id);
        const [ms, ps, pc] = await Promise.all([
          api.listPlaybooks(ws.id),
          api.listProspects(ws.id),
          api.getPrecall(ws.id),
        ]);
        setMethodologies(ms);
        setProspects(ps);
        if (pc.config) setConfig({ ...DEFAULT, ...pc.config });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  function onProspectSelect(id: string) {
    if (!id) {
      setConfig({ ...config, prospectId: null });
      return;
    }
    const p = prospects.find((x) => x.id === id);
    if (!p) return;
    setConfig({
      ...config,
      prospectId: p.id,
      prospectName: p.name,
      prospectCompany: p.company ?? "",
      prospectNotes: p.notes ?? "",
    });
  }

  async function save() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let prospectId = config.prospectId;
      if (!prospectId && config.prospectName.trim()) {
        const p = await api.createProspect({
          workspaceId,
          name: config.prospectName.trim(),
          company: config.prospectCompany.trim() || undefined,
          notes: config.prospectNotes.trim() || undefined,
        });
        prospectId = p.id;
      }
      const next = { ...config, prospectId };
      await api.setPrecall(workspaceId, next);
      setConfig(next);
      setSuccess("Guardado. El plugin lo leera al abrir pre-call.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Real-Time Sales Coaching</h1>
        <p className="mt-2 text-slate-400">
          Configura aqui la llamada. El plugin de Chrome usa esta config como pre-call por defecto.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-accent/40 bg-accent/5 p-4">
        <h2 className="text-sm font-semibold text-accent">Abrir plugin</h2>
        <p className="mt-1 text-sm text-slate-300">
          Click el icono del plugin "Real-Time Sales Coach" en la barra de Chrome y pulsa
          "Capturar pestana" dentro de Google Meet / Zoom Web / Teams Web.
        </p>
        <ol className="mt-2 list-decimal pl-5 text-xs text-slate-400">
          <li>Si no esta instalado: ve a chrome://extensions, activa "Modo desarrollador" y carga descomprimida desde apps/extension/dist.</li>
          <li>Pin el icono en la barra para acceso rapido.</li>
          <li>Abre la pestana de la videollamada antes de pulsar Capturar.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="chrome://extensions"
            className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:border-accent"
          >
            Abrir chrome://extensions
          </a>
          <Link
            href="/session/demo"
            className="rounded-md bg-accent px-3 py-1 text-xs text-background hover:bg-teal-300"
          >
            O usar simulador textual →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Metodologia">
          <select
            value={config.methodologyId ?? ""}
            onChange={(e) => setConfig({ ...config, methodologyId: e.target.value || null })}
            className="input"
          >
            <option value="">— Sin seleccionar —</option>
            {methodologies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.status !== "active" ? `(${m.status})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Idioma">
          <select
            value={config.language}
            onChange={(e) => setConfig({ ...config, language: e.target.value as "es" | "en" })}
            className="input"
          >
            <option value="es">Espanol</option>
            <option value="en">English</option>
          </select>
        </Field>

        <Field label="Nombre del prospect">
          <input
            value={config.prospectName}
            onChange={(e) => setConfig({ ...config, prospectName: e.target.value })}
            placeholder="Maria Lopez"
            className="input"
          />
        </Field>

        <Field label="Empresa">
          <input
            value={config.prospectCompany}
            onChange={(e) => setConfig({ ...config, prospectCompany: e.target.value })}
            placeholder="Acme SaaS"
            className="input"
          />
        </Field>

        <Field label="Cargar prospect existente" full>
          <select
            value={config.prospectId ?? ""}
            onChange={(e) => onProspectSelect(e.target.value)}
            className="input"
          >
            <option value="">— Crear nuevo (con datos de arriba) —</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.company ? ` · ${p.company}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas previas del prospect" full>
          <textarea
            value={config.prospectNotes}
            onChange={(e) => setConfig({ ...config, prospectNotes: e.target.value })}
            placeholder="Contexto, conversaciones anteriores, CRM..."
            className="input min-h-[100px] font-mono text-sm"
          />
        </Field>

        <Field label="Guion / hooks para esta llamada" full>
          <textarea
            value={config.script}
            onChange={(e) => setConfig({ ...config, script: e.target.value })}
            placeholder="Pega hooks, preguntas clave, frases especificas, hipotesis de valor..."
            className="input min-h-[200px] font-mono text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Plantilla disponible en docs/CALL_SCRIPT_TEMPLATE.md
          </p>
        </Field>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-teal-300 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar pre-call"}
        </button>
        <Link href="/history" className="text-xs text-slate-400 hover:text-accent">
          Historial →
        </Link>
        <Link href="/methodologies" className="text-xs text-slate-400 hover:text-accent">
          Metodologias →
        </Link>
      </div>

      {error && <div className="mt-4 rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</div>}
      {success && <div className="mt-4 rounded border border-accent/50 bg-accent/10 p-3 text-sm">{success}</div>}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: #0b0d10;
          border: 1px solid #1f242b;
          color: #e7ecef;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 13px;
        }
        :global(.input:focus) { outline: none; border-color: #5eead4; }
      `}</style>
    </main>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
