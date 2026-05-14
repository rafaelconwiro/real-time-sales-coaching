"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Stage {
  id?: string;
  name: string;
  order: number;
  goal: string;
  exitCriteria: string | null;
  requiredFields: string[];
  questions: { question: string; purpose: string | null; priority: string }[];
}
interface Objection {
  id?: string;
  name: string;
  detectionExamples: string[];
  recommendedResponse: string;
  recommendedQuestions: string[];
}
interface Signal {
  id?: string;
  type: string;
  name: string;
  detectionExamples: string[];
  recommendedAction: string;
}
interface Playbook {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentVersion: number;
  rawContent: string | null;
  stages: Stage[];
  objections: Objection[];
  signals: Signal[];
}

export default function MethodologyEditor() {
  const params = useParams();
  const id = String(params.id);
  const [pb, setPb] = useState<Playbook | null>(null);
  const [versions, setVersions] = useState<{ version: number; createdAt: string; label: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    try {
      const data = (await api.getPlaybook(id)) as Playbook;
      setPb(data);
      const vs = (await api.versions(id)) as any[];
      setVersions(vs.map((v) => ({ version: v.version, createdAt: v.createdAt, label: v.label })));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save() {
    if (!pb) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.updatePlaybook(id, {
        name: pb.name,
        description: pb.description,
        stages: pb.stages.map((s, i) => ({ ...s, order: i })),
        objections: pb.objections,
        signals: pb.signals,
      });
      setSuccess(`Guardado. Nueva version v${pb.currentVersion + 1}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(v: number) {
    if (!confirm(`Restaurar a version v${v}? Crea una version nueva sobre la actual.`)) return;
    try {
      await api.restoreVersion(id, v);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (error && !pb) return <main className="mx-auto max-w-3xl px-6 py-16 text-danger">{error}</main>;
  if (!pb) return <main className="mx-auto max-w-3xl px-6 py-16 text-slate-500">Cargando...</main>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/methodologies" className="text-xs text-slate-400 hover:text-accent">
        ← Biblioteca
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <input
          value={pb.name}
          onChange={(e) => setPb({ ...pb, name: e.target.value })}
          className="w-full bg-transparent text-2xl font-semibold focus:outline-none"
        />
        <div className="flex gap-2 text-sm">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-accent px-3 py-1 text-background hover:bg-teal-300 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
      <input
        value={pb.description ?? ""}
        onChange={(e) => setPb({ ...pb, description: e.target.value })}
        className="mt-2 w-full bg-transparent text-sm text-slate-400 focus:outline-none"
        placeholder="Descripcion corta"
      />

      {error && <div className="mt-3 rounded border border-danger/50 bg-danger/10 p-2 text-sm">{error}</div>}
      {success && <div className="mt-3 rounded border border-accent/50 bg-accent/10 p-2 text-sm">{success}</div>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Section title="Stages">
            {pb.stages.map((s, i) => (
              <StageEditor
                key={i}
                stage={s}
                onChange={(ns) => {
                  const next = [...pb.stages];
                  next[i] = ns;
                  setPb({ ...pb, stages: next });
                }}
                onRemove={() => setPb({ ...pb, stages: pb.stages.filter((_, idx) => idx !== i) })}
              />
            ))}
            <button
              onClick={() =>
                setPb({
                  ...pb,
                  stages: [
                    ...pb.stages,
                    {
                      name: "new_stage",
                      order: pb.stages.length,
                      goal: "",
                      exitCriteria: "",
                      requiredFields: [],
                      questions: [],
                    },
                  ],
                })
              }
              className="rounded border border-border bg-background px-3 py-1 text-xs hover:border-accent"
            >
              + Stage
            </button>
          </Section>

          <Section title="Objeciones">
            {pb.objections.map((o, i) => (
              <ObjectionEditor
                key={i}
                value={o}
                onChange={(no) => {
                  const next = [...pb.objections];
                  next[i] = no;
                  setPb({ ...pb, objections: next });
                }}
                onRemove={() => setPb({ ...pb, objections: pb.objections.filter((_, idx) => idx !== i) })}
              />
            ))}
            <button
              onClick={() =>
                setPb({
                  ...pb,
                  objections: [
                    ...pb.objections,
                    {
                      name: "nueva",
                      detectionExamples: [],
                      recommendedResponse: "",
                      recommendedQuestions: [],
                    },
                  ],
                })
              }
              className="rounded border border-border bg-background px-3 py-1 text-xs hover:border-accent"
            >
              + Objecion
            </button>
          </Section>

          <Section title="Senales">
            {pb.signals.map((sig, i) => (
              <SignalEditor
                key={i}
                value={sig}
                onChange={(ns) => {
                  const next = [...pb.signals];
                  next[i] = ns;
                  setPb({ ...pb, signals: next });
                }}
                onRemove={() => setPb({ ...pb, signals: pb.signals.filter((_, idx) => idx !== i) })}
              />
            ))}
            <button
              onClick={() =>
                setPb({
                  ...pb,
                  signals: [
                    ...pb.signals,
                    { type: "buying_signal", name: "nueva", detectionExamples: [], recommendedAction: "" },
                  ],
                })
              }
              className="rounded border border-border bg-background px-3 py-1 text-xs hover:border-accent"
            >
              + Senal
            </button>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Versiones">
            <ul className="space-y-2 text-sm">
              {versions.length === 0 ? (
                <li className="text-slate-500">Sin historial</li>
              ) : (
                versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-2">
                    <span>
                      v{v.version} <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleDateString()}</span>
                      {v.label && <span className="ml-1 text-xs text-slate-400">{v.label}</span>}
                    </span>
                    <button
                      onClick={() => restoreVersion(v.version)}
                      className="text-xs text-accent hover:underline"
                    >
                      Restaurar
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Section>
        </aside>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function input(value: string, onChange: (v: string) => void, placeholder?: string, mono = false) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded border border-border bg-background px-2 py-1 text-sm ${mono ? "font-mono" : ""}`}
    />
  );
}

function StageEditor({
  stage,
  onChange,
  onRemove,
}: {
  stage: Stage;
  onChange: (s: Stage) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="grid grid-cols-[1fr_80px] gap-2">
        {input(stage.name, (v) => onChange({ ...stage, name: v }), "name", true)}
        <button onClick={onRemove} className="text-xs text-danger hover:underline">
          eliminar
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {input(stage.goal, (v) => onChange({ ...stage, goal: v }), "goal")}
        {input(stage.exitCriteria ?? "", (v) => onChange({ ...stage, exitCriteria: v }), "exit criteria")}
        {input(
          stage.requiredFields.join(", "),
          (v) =>
            onChange({
              ...stage,
              requiredFields: v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          "requiredFields (csv)",
          true,
        )}
        <div className="text-xs text-slate-500">Preguntas:</div>
        {stage.questions.map((q, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_60px_30px] gap-1">
            {input(q.question, (v) => {
              const next = [...stage.questions];
              next[i] = { ...next[i]!, question: v };
              onChange({ ...stage, questions: next });
            })}
            {input(
              q.purpose ?? "",
              (v) => {
                const next = [...stage.questions];
                next[i] = { ...next[i]!, purpose: v };
                onChange({ ...stage, questions: next });
              },
              "purpose",
            )}
            <select
              value={q.priority}
              onChange={(e) => {
                const next = [...stage.questions];
                next[i] = { ...next[i]!, priority: e.target.value };
                onChange({ ...stage, questions: next });
              }}
              className="rounded border border-border bg-background px-1 text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <button
              onClick={() =>
                onChange({ ...stage, questions: stage.questions.filter((_, idx) => idx !== i) })
              }
              className="text-xs text-danger"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            onChange({
              ...stage,
              questions: [...stage.questions, { question: "", purpose: "", priority: "medium" }],
            })
          }
          className="self-start rounded border border-border bg-background px-2 py-0.5 text-xs hover:border-accent"
        >
          + pregunta
        </button>
      </div>
    </div>
  );
}

function ObjectionEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Objection;
  onChange: (o: Objection) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="grid grid-cols-[1fr_80px] gap-2">
        {input(value.name, (v) => onChange({ ...value, name: v }), "name", true)}
        <button onClick={onRemove} className="text-xs text-danger hover:underline">
          eliminar
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {input(
          value.detectionExamples.join("; "),
          (v) =>
            onChange({
              ...value,
              detectionExamples: v
                .split(";")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          "detection examples (separados por ;)",
        )}
        {input(value.recommendedResponse, (v) => onChange({ ...value, recommendedResponse: v }), "recommended response")}
        {input(
          value.recommendedQuestions.join("; "),
          (v) =>
            onChange({
              ...value,
              recommendedQuestions: v
                .split(";")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          "recommended questions (separados por ;)",
        )}
      </div>
    </div>
  );
}

function SignalEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Signal;
  onChange: (s: Signal) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="grid grid-cols-[1fr_120px_80px] gap-2">
        {input(value.name, (v) => onChange({ ...value, name: v }), "name", true)}
        <select
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
          className="rounded border border-border bg-background px-1 text-xs"
        >
          <option value="buying_signal">buying_signal</option>
          <option value="risk_signal">risk_signal</option>
          <option value="missing_info">missing_info</option>
          <option value="competitor">competitor</option>
          <option value="urgency">urgency</option>
          <option value="budget">budget</option>
          <option value="objection">objection</option>
        </select>
        <button onClick={onRemove} className="text-xs text-danger hover:underline">
          eliminar
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {input(
          value.detectionExamples.join("; "),
          (v) =>
            onChange({
              ...value,
              detectionExamples: v
                .split(";")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          "detection examples (separados por ;)",
        )}
        {input(value.recommendedAction, (v) => onChange({ ...value, recommendedAction: v }), "recommended action")}
      </div>
    </div>
  );
}
