import { DEFAULT_API_BASE, getApiBase } from "./lib/config";
import type { PrecallPayload } from "./lib/messages";

interface MethodologySummary {
  id: string;
  name: string;
  description?: string | null;
}

interface ProspectSummary {
  id: string;
  name: string;
  company: string | null;
  notes: string | null;
}

const STORAGE_KEY = "precallConfig";

const methodologyEl = document.getElementById("methodology") as HTMLSelectElement;
const languageEl = document.getElementById("language") as HTMLSelectElement;
const scriptEl = document.getElementById("script") as HTMLTextAreaElement;
const prospectNameEl = document.getElementById("prospect-name") as HTMLInputElement;
const prospectCompanyEl = document.getElementById("prospect-company") as HTMLInputElement;
const prospectNotesEl = document.getElementById("prospect-notes") as HTMLTextAreaElement;
const prospectSearchEl = document.getElementById("prospect-search") as HTMLSelectElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const audioStartBtn = document.getElementById("audio-start") as HTMLButtonElement;
const audioStopBtn = document.getElementById("audio-stop") as HTMLButtonElement;
const audioStatusEl = document.getElementById("audio-status") as HTMLDivElement;
const meterMic = document.getElementById("meter-mic") as HTMLDivElement;
const meterTab = document.getElementById("meter-tab") as HTMLDivElement;
const meterMicVal = document.getElementById("meter-mic-val") as HTMLSpanElement;
const meterTabVal = document.getElementById("meter-tab-val") as HTMLSpanElement;

let prospectsCache: ProspectSummary[] = [];
let selectedProspectId: string | null = null;

void init();

async function init() {
  const localConfig = await loadConfig();
  const ws = await loadWorkspace();
  const remoteConfig = ws ? await loadRemoteConfig(ws) : null;
  const config = remoteConfig ?? localConfig;

  scriptEl.value = config.script;
  languageEl.value = config.language ?? "es";
  prospectNameEl.value = config.prospectName;
  prospectCompanyEl.value = config.prospectCompany;
  prospectNotesEl.value = config.prospectNotes;
  selectedProspectId = config.prospectId;

  if (ws) {
    await Promise.all([loadMethodologies(config.methodologyId, ws), loadProspects(ws)]);
  }

  saveBtn.addEventListener("click", save);
  clearBtn.addEventListener("click", () => {
    scriptEl.value = "";
  });
  prospectSearchEl.addEventListener("change", onProspectSelect);
  audioStartBtn.addEventListener("click", startAudioTest);
  audioStopBtn.addEventListener("click", stopAudioTest);
}

async function loadWorkspace(): Promise<string | null> {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    const res = await fetch(`${apiBase}/api/workspaces/default`);
    if (!res.ok) return null;
    const w = (await res.json()) as { id: string };
    return w.id;
  } catch {
    return null;
  }
}

async function loadRemoteConfig(workspaceId: string): Promise<PrecallPayload | null> {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/precall`);
    if (!res.ok) return null;
    const data = (await res.json()) as { config: Partial<PrecallPayload> | null };
    if (!data.config) return null;
    return {
      methodologyId: data.config.methodologyId ?? null,
      prospectId: data.config.prospectId ?? null,
      language: data.config.language ?? "es",
      script: data.config.script ?? "",
      prospectName: data.config.prospectName ?? "",
      prospectCompany: data.config.prospectCompany ?? "",
      prospectNotes: data.config.prospectNotes ?? "",
    };
  } catch {
    return null;
  }
}

async function saveRemoteConfig(workspaceId: string, config: PrecallPayload) {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    await fetch(`${apiBase}/api/workspaces/${workspaceId}/precall`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
  } catch {
    // ignore
  }
}

async function loadMethodologies(preselected: string | null, workspaceId: string) {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    const playRes = await fetch(`${apiBase}/api/playbooks?workspaceId=${workspaceId}`);
    if (!playRes.ok) throw new Error(`playbooks HTTP ${playRes.status}`);
    const methodologies = (await playRes.json()) as MethodologySummary[];
    methodologyEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Sin seleccionar —";
    methodologyEl.appendChild(empty);
    for (const m of methodologies) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (preselected === m.id) opt.selected = true;
      methodologyEl.appendChild(opt);
    }
  } catch (err) {
    methodologyEl.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `Error: ${(err as Error).message}`;
    methodologyEl.appendChild(opt);
  }
}

async function loadProspects(workspaceId: string) {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    const res = await fetch(`${apiBase}/api/prospects?workspaceId=${workspaceId}`);
    if (!res.ok) return;
    prospectsCache = (await res.json()) as ProspectSummary[];
    prospectSearchEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Crear nuevo —";
    prospectSearchEl.appendChild(empty);
    for (const p of prospectsCache) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name}${p.company ? " · " + p.company : ""}`;
      if (p.id === selectedProspectId) opt.selected = true;
      prospectSearchEl.appendChild(opt);
    }
  } catch {
    // ignore
  }
}

function onProspectSelect() {
  const id = prospectSearchEl.value;
  if (!id) {
    selectedProspectId = null;
    return;
  }
  const p = prospectsCache.find((x) => x.id === id);
  if (!p) return;
  selectedProspectId = p.id;
  prospectNameEl.value = p.name;
  prospectCompanyEl.value = p.company ?? "";
  prospectNotesEl.value = p.notes ?? "";
}

async function save() {
  saveBtn.disabled = true;
  let prospectId = selectedProspectId;
  if (!prospectId && prospectNameEl.value.trim()) {
    const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
    const ws = await loadWorkspace();
    if (ws) {
      try {
        const res = await fetch(`${apiBase}/api/prospects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: ws,
            name: prospectNameEl.value.trim(),
            company: prospectCompanyEl.value.trim() || undefined,
            notes: prospectNotesEl.value.trim() || undefined,
          }),
        });
        if (res.ok) {
          const p = (await res.json()) as { id: string };
          prospectId = p.id;
        }
      } catch {
        // ignore — keep local-only data
      }
    }
  } else if (prospectId && prospectNotesEl.value.trim()) {
    const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
    try {
      await fetch(`${apiBase}/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: prospectNotesEl.value.trim() }),
      });
    } catch {
      // ignore
    }
  }

  const config: PrecallPayload = {
    methodologyId: methodologyEl.value || null,
    prospectId,
    language: (languageEl.value as "es" | "en") ?? "es",
    script: scriptEl.value.trim(),
    prospectName: prospectNameEl.value.trim(),
    prospectCompany: prospectCompanyEl.value.trim(),
    prospectNotes: prospectNotesEl.value.trim(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  const ws = await loadWorkspace();
  if (ws) await saveRemoteConfig(ws, config);
  showStatus("Guardado (local + remoto). Pulsa Capturar cuando estes listo.", "ok");
  saveBtn.disabled = false;
}

function showStatus(message: string, kind: "ok" | "error") {
  statusEl.style.display = "block";
  statusEl.textContent = message;
  statusEl.style.borderColor = kind === "ok" ? "#5eead4" : "#f87171";
  statusEl.style.color = kind === "ok" ? "#5eead4" : "#fca5a5";
}

async function loadConfig(): Promise<PrecallPayload> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const stored = res[STORAGE_KEY] as Partial<PrecallPayload> | undefined;
      resolve({
        methodologyId: stored?.methodologyId ?? null,
        prospectId: stored?.prospectId ?? null,
        language: stored?.language ?? "es",
        script: stored?.script ?? "",
        prospectName: stored?.prospectName ?? "",
        prospectCompany: stored?.prospectCompany ?? "",
        prospectNotes: stored?.prospectNotes ?? "",
      });
    });
  });
}

let audioTestCtx: AudioContext | null = null;
let audioTestMic: MediaStream | null = null;
let audioTestAnimation: number | null = null;

async function startAudioTest() {
  audioStartBtn.disabled = true;
  try {
    audioTestCtx = new AudioContext();
    audioTestMic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micAnalyser = audioTestCtx.createAnalyser();
    micAnalyser.fftSize = 1024;
    audioTestCtx.createMediaStreamSource(audioTestMic).connect(micAnalyser);
    const micBuf = new Uint8Array(micAnalyser.fftSize);

    audioStatusEl.textContent =
      "Mic capturando. Para probar la pestana, esta funcion solo testea el micro porque la captura de pestana requiere abrir desde el popup en la pestana destino.";

    audioStopBtn.disabled = false;
    const loop = () => {
      micAnalyser.getByteTimeDomainData(micBuf);
      let peak = 0;
      for (const v of micBuf) {
        const d = Math.abs(v - 128) / 128;
        if (d > peak) peak = d;
      }
      const pct = Math.min(100, peak * 200);
      meterMic.style.width = pct + "%";
      meterMicVal.textContent = `${pct.toFixed(0)}%`;
      meterTab.style.width = "0%";
      meterTabVal.textContent = "n/a";
      audioTestAnimation = requestAnimationFrame(loop);
    };
    loop();
  } catch (err) {
    audioStatusEl.textContent = `Error: ${(err as Error).message}`;
    audioStartBtn.disabled = false;
  }
}

function stopAudioTest() {
  if (audioTestAnimation) cancelAnimationFrame(audioTestAnimation);
  audioTestAnimation = null;
  audioTestMic?.getTracks().forEach((t) => t.stop());
  audioTestMic = null;
  audioTestCtx?.close().catch(() => {});
  audioTestCtx = null;
  meterMic.style.width = "0%";
  meterTab.style.width = "0%";
  meterMicVal.textContent = "—";
  meterTabVal.textContent = "—";
  audioStartBtn.disabled = false;
  audioStopBtn.disabled = true;
  audioStatusEl.textContent = "";
}

export {};
