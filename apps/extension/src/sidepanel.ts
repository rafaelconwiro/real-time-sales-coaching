import type { StageName } from "@rtsc/shared";
import type { CaptureSnapshot, ExtMessage } from "./lib/messages";

const STAGE_LABEL: Record<StageName, string> = {
  opening: "Apertura",
  discovery: "Discovery",
  qualification: "Calificacion",
  solution_framing: "Encaje",
  objection_handling: "Objeciones",
  closing: "Cierre",
  next_steps: "Proximos pasos",
};

const STAGE_GOAL: Record<StageName, string> = {
  opening: "Romper hielo. Alinear agenda.",
  discovery: "Entender dolor e impacto.",
  qualification: "Validar presupuesto, decisor y timeline.",
  solution_framing: "Conectar dolor con propuesta.",
  objection_handling: "Resolver objeciones con preguntas.",
  closing: "Pedir avance claro con fecha.",
  next_steps: "Confirmar accion + owner + fecha.",
};

const FIELD_LABEL: Record<string, string> = {
  pain: "Dolor",
  impact: "Impacto",
  budget: "Presupuesto",
  decisionMaker: "Decisor",
  timeline: "Timeline",
};

const statusEl = el("status");
const stageEl = el("stage");
const stageGoalEl = el("stage-goal");
const recTitleEl = el("rec-title");
const recMessageEl = el("rec-message");
const recPhraseEl = el("rec-phrase");
const fieldsEl = el("fields");
const signalsEl = el("signals");
const transcriptEl = el("transcript");

void init();

async function init() {
  const res = await sendMessage({ type: "sidepanel:get-snapshot" });
  if (res.ok && res.data) render(res.data as CaptureSnapshot);
  chrome.runtime.onMessage.addListener((msg: ExtMessage) => {
    if (msg.type === "snapshot") render(msg.snapshot);
  });
}

function render(s: CaptureSnapshot) {
  statusEl.textContent =
    s.status === "live"
      ? `live · ${s.sessionId?.slice(0, 8) ?? ""}`
      : s.status === "error"
        ? `error · ${s.errorMessage ?? ""}`
        : `${s.status} · sin sesion`;
  statusEl.className =
    "status" + (s.status === "live" ? " live" : s.status === "error" ? " error" : "");

  const stage = (s.state?.stage ?? "opening") as StageName;
  stageEl.textContent = STAGE_LABEL[stage] ?? stage;
  stageGoalEl.textContent = STAGE_GOAL[stage] ?? "";

  const rec = s.recommendations[0];
  if (rec) {
    recTitleEl.textContent = rec.title;
    recMessageEl.textContent = rec.message;
    if (rec.suggestedPhrase) {
      recPhraseEl.style.display = "block";
      recPhraseEl.textContent = `"${rec.suggestedPhrase}"`;
    } else {
      recPhraseEl.style.display = "none";
    }
  } else {
    recTitleEl.textContent = "Sin recomendacion";
    recMessageEl.textContent = s.status === "live" ? "Sigue indagando." : "Inicia captura para recibir coaching.";
    recPhraseEl.style.display = "none";
  }

  renderFields(s.state?.knownFields ?? {}, s.state?.missingFields ?? []);
  renderSignals(s);
  renderTranscript(s);
}

function renderFields(known: Record<string, string | null>, missing: string[]) {
  const all = Array.from(new Set([...Object.keys(known), ...missing]));
  if (all.length === 0) {
    fieldsEl.textContent = "Sin campos requeridos.";
    return;
  }
  fieldsEl.innerHTML = "";
  for (const f of all) {
    const row = document.createElement("div");
    row.className = "field-row";
    const left = document.createElement("span");
    left.textContent = FIELD_LABEL[f] ?? f;
    const right = document.createElement("span");
    const ok = !!known[f];
    right.textContent = ok ? "ok" : "falta";
    right.className = ok ? "ok" : "miss";
    row.append(left, right);
    fieldsEl.appendChild(row);
  }
}

function renderSignals(s: CaptureSnapshot) {
  const last = s.signals.slice(-4).reverse();
  if (last.length === 0) {
    signalsEl.textContent = "Aun sin senales.";
    return;
  }
  signalsEl.innerHTML = "";
  for (const sig of last) {
    const row = document.createElement("div");
    row.className = "field-row";
    const left = document.createElement("span");
    left.textContent = `${sig.type} · ${sig.label}`;
    const right = document.createElement("span");
    right.textContent = `${Math.round(sig.confidence * 100)}%`;
    row.append(left, right);
    signalsEl.appendChild(row);
  }
}

function renderTranscript(s: CaptureSnapshot) {
  const segs = s.recentSegments.slice(-6);
  if (segs.length === 0) {
    transcriptEl.textContent = s.status === "live" ? "Escuchando..." : "—";
    return;
  }
  transcriptEl.innerHTML = "";
  for (const seg of segs) {
    const line = document.createElement("div");
    const tag = document.createElement("span");
    tag.textContent = `${seg.speaker}: `;
    tag.style.color = seg.speaker === "seller" ? "#5eead4" : "#7dd3fc";
    const text = document.createElement("span");
    text.textContent = seg.text;
    line.append(tag, text);
    transcriptEl.appendChild(line);
  }
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node;
}

function sendMessage(msg: ExtMessage): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message });
      else resolve(response ?? { ok: false, error: "no response" });
    });
  });
}
