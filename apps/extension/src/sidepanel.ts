import type { StageName } from "@rtsc/shared";
import type { CaptureSnapshot, ExtMessage, PrecallPayload } from "./lib/messages";

const PRECALL_KEY = "precallConfig";

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
const stageExitEl = el("stage-exit");
const recTitleEl = el("rec-title");
const recMessageEl = el("rec-message");
const recPhraseEl = el("rec-phrase");
const fieldsEl = el("fields");
const signalsEl = el("signals");
const transcriptEl = el("transcript");
const startBtn = el("start") as HTMLButtonElement;
const pauseBtn = el("pause") as HTMLButtonElement;
const resumeBtn = el("resume") as HTMLButtonElement;
const stopBtn = el("stop") as HTMLButtonElement;
const popoutBtn = el("popout") as HTMLButtonElement;
const errorEl = el("error");
const saveTranscriptBtn = el("save-transcript") as HTMLButtonElement;
const autosaveEl = el("autosave") as HTMLInputElement;

void init();

async function init() {
  const res = await sendMessage({ type: "sidepanel:get-snapshot" });
  if (res.ok && res.data) render(res.data as CaptureSnapshot);
  chrome.runtime.onMessage.addListener((msg: ExtMessage) => {
    if (msg.type === "snapshot") render(msg.snapshot);
  });

  startBtn.addEventListener("click", startCapture);
  popoutBtn.addEventListener("click", async () => {
    await sendMessage({ type: "coach-window:toggle" });
  });

  chrome.storage.local.get(["autoSaveTranscript"], (r) => {
    autosaveEl.checked = r.autoSaveTranscript !== false;
  });
  autosaveEl.addEventListener("change", () => {
    chrome.storage.local.set({ autoSaveTranscript: autosaveEl.checked });
  });
  saveTranscriptBtn.addEventListener("click", async () => {
    const snap = (await sendMessage({ type: "sidepanel:get-snapshot" })).data as CaptureSnapshot | undefined;
    if (!snap?.sessionId) return;
    const url = `${snap.apiBase}/api/sessions/${snap.sessionId}/export.json`;
    chrome.downloads.download({
      url,
      filename: `salescoach/session-${snap.sessionId.slice(0, 8)}.json`,
      saveAs: false,
    });
  });
  pauseBtn.addEventListener("click", async () => {
    pauseBtn.disabled = true;
    await sendMessage({ type: "popup:pause" });
  });
  resumeBtn.addEventListener("click", async () => {
    resumeBtn.disabled = true;
    await sendMessage({ type: "popup:resume" });
  });
  stopBtn.addEventListener("click", async () => {
    hideError();
    stopBtn.disabled = true;
    const res = await sendMessage({ type: "popup:stop" });
    if (!res.ok) {
      showError(res.error ?? "no se pudo apagar");
      stopBtn.disabled = false;
    }
  });
}

async function startCapture() {
  startBtn.disabled = true;
  hideError();
  try {
    if (!(await hasMicPermission())) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("permissions.html") });
      throw new Error(
        "Concede permiso de micro en pestana abierta y vuelve a pulsar Capturar.",
      );
    }
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("Sin pestana activa");
    const streamId = await getStreamId(tab.id);
    const precall = await loadPrecall();
    const res = await sendMessage({
      type: "popup:start",
      streamId,
      tabId: tab.id,
      precall,
    });
    if (!res.ok) showError(res.error ?? "error");
  } catch (err) {
    showError((err as Error).message);
  }
}

async function hasMicPermission(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

function getStreamId(targetTabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
      const err = chrome.runtime.lastError;
      if (err || !id) reject(new Error(err?.message ?? "no streamId"));
      else resolve(id);
    });
  });
}

async function loadPrecall(): Promise<PrecallPayload> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PRECALL_KEY], (res) => {
      const v = res[PRECALL_KEY] as Partial<PrecallPayload> | undefined;
      resolve({
        methodologyId: v?.methodologyId ?? null,
        prospectId: v?.prospectId ?? null,
        language: v?.language ?? "es",
        script: v?.script ?? "",
        prospectName: v?.prospectName ?? "",
        prospectCompany: v?.prospectCompany ?? "",
        prospectNotes: v?.prospectNotes ?? "",
      });
    });
  });
}

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
  startBtn.disabled = false;
}

function hideError() {
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function render(s: CaptureSnapshot) {
  const coach = s.status === "live" || s.status === "paused" ? ` · ${s.coachingStatus}` : "";
  statusEl.textContent =
    s.status === "live"
      ? `live${coach} · ${s.sessionId?.slice(0, 8) ?? ""}`
      : s.status === "paused"
        ? `pausado · ${s.sessionId?.slice(0, 8) ?? ""}`
        : s.status === "error"
          ? `error · ${s.errorMessage ?? ""}`
          : `${s.status} · sin sesion`;
  statusEl.className =
    "status" + (s.status === "live" ? " live" : s.status === "error" ? " error" : "");

  const busy = s.status === "starting" || s.status === "stopping";
  const hasSession = !!s.sessionId;
  if (s.status === "live") {
    startBtn.disabled = true;
    pauseBtn.style.display = "";
    pauseBtn.disabled = false;
    resumeBtn.style.display = "none";
    resumeBtn.disabled = true;
    stopBtn.disabled = false;
  } else if (s.status === "paused") {
    startBtn.disabled = true;
    pauseBtn.style.display = "none";
    pauseBtn.disabled = true;
    resumeBtn.style.display = "";
    resumeBtn.disabled = false;
    stopBtn.disabled = false;
  } else {
    startBtn.disabled = busy;
    pauseBtn.style.display = "";
    pauseBtn.disabled = true;
    resumeBtn.style.display = "none";
    resumeBtn.disabled = true;
    stopBtn.disabled = !hasSession;
  }

  if (s.status === "error" && s.errorMessage) {
    errorEl.textContent = s.errorMessage;
    errorEl.style.display = "block";
  } else if (s.status !== "error") {
    errorEl.style.display = "none";
  }

  saveTranscriptBtn.disabled = !s.sessionId;

  const stage = (s.state?.stage ?? "opening") as StageName;
  stageEl.textContent = STAGE_LABEL[stage] ?? stage;
  stageGoalEl.textContent = STAGE_GOAL[stage] ?? "";
  stageExitEl.textContent = s.exitCriteria ? `Exit: ${s.exitCriteria}` : "";

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
