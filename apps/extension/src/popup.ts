import type { CaptureSnapshot, ExtMessage, PrecallPayload } from "./lib/messages";
import { DEFAULT_API_BASE, getApiBase, setApiBase } from "./lib/config";

const PRECALL_KEY = "precallConfig";

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

const statusEl = document.getElementById("status") as HTMLDivElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const startBtn = document.getElementById("start") as HTMLButtonElement;
const pauseBtn = document.getElementById("pause") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const openPanelBtn = document.getElementById("open-panel") as HTMLButtonElement;
const openPrecallBtn = document.getElementById("open-precall") as HTMLButtonElement;
const precallSummary = document.getElementById("precall-summary") as HTMLDivElement;
const precallInfo = document.getElementById("precall-info") as HTMLDivElement;
const apiInput = document.getElementById("api-base") as HTMLInputElement;

async function init() {
  apiInput.value = await getApiBase();
  apiInput.addEventListener("change", () => {
    const v = apiInput.value.trim() || DEFAULT_API_BASE;
    void setApiBase(v);
  });

  await renderPrecall();

  openPrecallBtn.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("precall.html") });
  });

  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    try {
      if (!(await hasMicPermission())) {
        await chrome.tabs.create({ url: chrome.runtime.getURL("permissions.html") });
        throw new Error(
          "Concede el permiso de microfono en la pestana que se abrio y luego pulsa Capturar otra vez.",
        );
      }
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error("No hay pestana activa");
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
  });
  pauseBtn.addEventListener("click", async () => {
    pauseBtn.disabled = true;
    const res = await sendMessage({ type: "popup:pause" });
    if (!res.ok) showError(res.error ?? "error");
  });
  resumeBtn.addEventListener("click", async () => {
    resumeBtn.disabled = true;
    const res = await sendMessage({ type: "popup:resume" });
    if (!res.ok) showError(res.error ?? "error");
  });
  stopBtn.addEventListener("click", async () => {
    stopBtn.disabled = true;
    const res = await sendMessage({ type: "popup:stop" });
    if (!res.ok) showError(res.error ?? "error");
  });
  openPanelBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (tab?.id && chrome.sidePanel?.open) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (err) {
        showError(`No se pudo abrir el panel: ${(err as Error).message}`);
      }
    }
  });

  await refresh();
  chrome.runtime.onMessage.addListener((msg: ExtMessage) => {
    if (msg.type === "snapshot") render(msg.snapshot);
  });
}

async function refresh() {
  const res = await sendMessage({ type: "popup:get-snapshot" });
  if (res.ok && res.data) render(res.data as CaptureSnapshot);
}

function render(s: CaptureSnapshot) {
  const coach = s.status === "live" ? ` (${s.coachingStatus})` : "";
  statusEl.textContent =
    labelFor(s.status) + coach + (s.sessionId ? ` · ${s.sessionId.slice(0, 8)}` : "");
  statusEl.className =
    "status" + (s.status === "live" ? " live" : s.status === "error" ? " error" : "");
  if (s.status === "error" && s.errorMessage) {
    errorEl.textContent = s.errorMessage;
    errorEl.style.display = "block";
  } else {
    errorEl.style.display = "none";
  }
  const busy = s.status === "starting" || s.status === "stopping";
  startBtn.disabled = busy || s.status === "live" || s.status === "paused";
  stopBtn.disabled = busy || (s.status !== "live" && s.status !== "paused");
  if (s.status === "live") {
    pauseBtn.style.display = "";
    pauseBtn.disabled = false;
    resumeBtn.style.display = "none";
    resumeBtn.disabled = true;
  } else if (s.status === "paused") {
    pauseBtn.style.display = "none";
    pauseBtn.disabled = true;
    resumeBtn.style.display = "";
    resumeBtn.disabled = false;
  } else {
    pauseBtn.style.display = "";
    pauseBtn.disabled = true;
    resumeBtn.style.display = "none";
    resumeBtn.disabled = true;
  }
}

function labelFor(status: CaptureSnapshot["status"]): string {
  switch (status) {
    case "idle":
      return "idle";
    case "starting":
      return "iniciando...";
    case "live":
      return "live";
    case "paused":
      return "pausado";
    case "stopping":
      return "parando...";
    case "error":
      return "error";
  }
}

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function renderPrecall() {
  const cfg = await loadPrecall();
  const hasScript = cfg.script.trim().length > 0;
  const hasMethodology = !!cfg.methodologyId;
  if (!hasScript && !hasMethodology && !cfg.prospectName && !cfg.prospectCompany) {
    precallSummary.style.display = "none";
    return;
  }
  precallSummary.style.display = "block";
  const lines: string[] = [];
  if (hasMethodology) lines.push(`Metodologia: ${cfg.methodologyId}`);
  if (cfg.prospectName || cfg.prospectCompany) {
    lines.push(`Prospect: ${[cfg.prospectName, cfg.prospectCompany].filter(Boolean).join(" · ")}`);
  }
  if (hasScript) lines.push(`Guion: ${cfg.script.length} caracteres`);
  precallInfo.textContent = lines.join(" | ");
}

async function hasMicPermission(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state === "granted";
  } catch {
    return false;
  }
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

function sendMessage(msg: ExtMessage): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message });
      else resolve(response ?? { ok: false, error: "no response" });
    });
  });
}

init().catch((err) => showError((err as Error).message));
