import type { CaptureSnapshot, ExtMessage } from "./lib/messages";

const statusEl = el("status");
const titleEl = el("title");
const messageEl = el("message");
const phraseEl = el("phrase");

void init();

async function init() {
  const res = await sendMessage({ type: "sidepanel:get-snapshot" });
  if (res.ok && res.data) render(res.data as CaptureSnapshot);
  chrome.runtime.onMessage.addListener((msg: ExtMessage) => {
    if (msg.type === "snapshot") render(msg.snapshot);
  });
}

function render(s: CaptureSnapshot) {
  const coach = s.status === "live" || s.status === "paused" ? ` · ${s.coachingStatus}` : "";
  statusEl.textContent = `${s.status}${coach}`;
  const rec = s.recommendations[0];
  if (rec) {
    titleEl.textContent = rec.title;
    messageEl.textContent = rec.message;
    if (rec.suggestedPhrase) {
      phraseEl.style.display = "block";
      phraseEl.textContent = `"${rec.suggestedPhrase}"`;
    } else {
      phraseEl.style.display = "none";
    }
  } else {
    titleEl.textContent = "Sin recomendacion";
    messageEl.textContent = s.status === "live" ? "Sigue indagando." : "Inicia captura.";
    phraseEl.style.display = "none";
  }
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
