import type {
  CoachingStatus,
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";
import { getApiBase } from "./lib/config";
import type {
  CaptureSnapshot,
  CaptureStatus,
  ExtMessage,
  ExtResponse,
  PrecallPayload,
} from "./lib/messages";

const OFFSCREEN_URL = "offscreen.html";

const snapshot: CaptureSnapshot = {
  status: "idle",
  coachingStatus: "idle",
  sessionId: null,
  tabId: null,
  apiBase: "http://localhost:4000",
  state: null,
  recommendations: [],
  signals: [],
  recentSegments: [],
  exitCriteria: null,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (snapshot.tabId === tabId && snapshot.status !== "idle") {
    stopCapture().catch((err) => {
      console.warn("auto-stop on tab close failed:", err);
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (snapshot.tabId !== tabId || snapshot.status !== "live") return;
  if (info.url) {
    stopCapture().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener(
  (msg: ExtMessage, _sender, sendResponse: (r: ExtResponse) => void) => {
    (async () => {
      try {
        switch (msg.type) {
          case "popup:start":
            await startCapture(msg.streamId, msg.tabId, msg.precall);
            sendResponse({ ok: true, data: snapshot });
            break;
          case "popup:stop":
            await stopCapture();
            sendResponse({ ok: true, data: snapshot });
            break;
          case "popup:pause":
            await pauseCapture();
            sendResponse({ ok: true, data: snapshot });
            break;
          case "popup:resume":
            await resumeCapture();
            sendResponse({ ok: true, data: snapshot });
            break;
          case "coach-window:toggle":
            await toggleCoachWindow();
            sendResponse({ ok: true });
            break;
          case "coach-window:close":
            await closeCoachWindow();
            sendResponse({ ok: true });
            break;
          case "popup:get-snapshot":
          case "sidepanel:get-snapshot":
            sendResponse({ ok: true, data: snapshot });
            break;
          case "offscreen:status":
            updateStatus(msg.status, msg.message);
            sendResponse({ ok: true });
            break;
          default:
            sendResponse({ ok: false, error: `unknown message: ${(msg as ExtMessage).type}` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        snapshot.status = "error";
        snapshot.errorMessage = message;
        broadcast();
        sendResponse({ ok: false, error: message });
      }
    })();
    return true;
  },
);

chrome.runtime.onMessage.addListener((msg: any) => {
  if (!msg || typeof msg !== "object") return;
  switch (msg.type) {
    case "event:state":
      snapshot.state = msg.state as ConversationStatePayload;
      broadcast();
      break;
    case "event:status":
      snapshot.coachingStatus = msg.status as CoachingStatus;
      broadcast();
      break;
    case "event:exit-criteria":
      snapshot.exitCriteria = msg.exitCriteria ?? null;
      broadcast();
      break;
    case "event:recommendation":
      snapshot.recommendations = [
        msg.recommendation as LiveRecommendationPayload,
        ...snapshot.recommendations,
      ].slice(0, 20);
      broadcast();
      break;
    case "event:signal":
      snapshot.signals = [...snapshot.signals, msg.signal as DetectedSignalPayload].slice(-50);
      broadcast();
      break;
    case "event:transcript":
      snapshot.recentSegments = [
        ...snapshot.recentSegments,
        msg.segment as TranscriptSegmentPayload,
      ].slice(-30);
      broadcast();
      break;
    case "event:session-ready":
      snapshot.sessionId = msg.sessionId;
      snapshot.state = msg.state ?? snapshot.state;
      snapshot.status = "live";
      snapshot.errorMessage = undefined;
      broadcast();
      break;
    case "event:paused":
      snapshot.status = "paused";
      snapshot.coachingStatus = "paused";
      broadcast();
      break;
    case "event:resumed":
      snapshot.status = "live";
      snapshot.coachingStatus = "listening";
      broadcast();
      break;
    case "event:error":
      snapshot.status = "error";
      snapshot.errorMessage = msg.message;
      broadcast();
      break;
    case "event:ended":
      snapshot.status = "idle";
      snapshot.coachingStatus = "idle";
      broadcast();
      break;
  }
});

async function startCapture(streamId: string, tabId: number, precall: PrecallPayload) {
  if (snapshot.status === "live" || snapshot.status === "starting") return;
  snapshot.status = "starting";
  snapshot.coachingStatus = "idle";
  snapshot.errorMessage = undefined;
  snapshot.recommendations = [];
  snapshot.signals = [];
  snapshot.recentSegments = [];
  snapshot.exitCriteria = null;
  snapshot.tabId = tabId;
  broadcast();

  const apiBase = await getApiBase();
  snapshot.apiBase = apiBase;

  try {
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch {
    // ignore
  }

  let tabTitle = "Videollamada";
  try {
    const tab = await chrome.tabs.get(tabId);
    tabTitle = tab.title ?? tabTitle;
  } catch {
    // ignore
  }

  const sessionRes = await fetch(`${apiBase}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "video_call",
      title: tabTitle,
      methodologyId: precall.methodologyId ?? undefined,
      prospectId: precall.prospectId ?? undefined,
      language: precall.language ?? "es",
      script: precall.script ? precall.script : undefined,
      prospectName: precall.prospectName ? precall.prospectName : undefined,
      prospectCompany: precall.prospectCompany ? precall.prospectCompany : undefined,
    }),
  });
  if (!sessionRes.ok) {
    throw new Error(`API /sessions HTTP ${sessionRes.status}`);
  }
  const session = (await sessionRes.json()) as { id: string };
  snapshot.sessionId = session.id;

  await ensureOffscreen();
  await chrome.runtime.sendMessage<ExtMessage>({
    type: "offscreen:start",
    sessionId: session.id,
    streamId,
    apiBase,
  });

  broadcast();
}

async function stopCapture() {
  const endedSessionId = snapshot.sessionId;
  const endedApiBase = snapshot.apiBase;
  snapshot.status = "stopping";
  broadcast();
  try {
    await chrome.runtime.sendMessage<ExtMessage>({ type: "offscreen:stop" });
  } catch {
    // ignore
  }
  snapshot.status = "idle";
  snapshot.coachingStatus = "idle";
  snapshot.sessionId = null;
  broadcast();
  if (endedSessionId) void autoSaveTranscript(endedApiBase, endedSessionId);
}

async function autoSaveTranscript(apiBase: string, sessionId: string) {
  try {
    const wantSave = await getAutoSavePref();
    if (!wantSave) return;
    const url = `${apiBase}/api/sessions/${sessionId}/export.json`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await chrome.downloads.download({
      url,
      filename: `salescoach/session-${stamp}-${sessionId.slice(0, 8)}.json`,
      saveAs: false,
    });
  } catch (err) {
    console.warn("auto-save transcript failed:", err);
  }
}

async function getAutoSavePref(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["autoSaveTranscript"], (res) => {
      resolve(res.autoSaveTranscript !== false);
    });
  });
}

async function pauseCapture() {
  if (snapshot.status !== "live") return;
  try {
    await chrome.runtime.sendMessage<ExtMessage>({ type: "offscreen:pause" });
  } catch {
    // ignore
  }
}

async function resumeCapture() {
  if (snapshot.status !== "paused") return;
  try {
    await chrome.runtime.sendMessage<ExtMessage>({ type: "offscreen:resume" });
  } catch {
    // ignore
  }
}

let coachWindowId: number | null = null;

async function toggleCoachWindow() {
  if (coachWindowId !== null) {
    await closeCoachWindow();
    return;
  }
  try {
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("coach-popup.html"),
      type: "popup",
      width: 380,
      height: 220,
      focused: false,
    });
    coachWindowId = win.id ?? null;
  } catch (err) {
    console.warn("coach window create failed:", err);
  }
}

async function closeCoachWindow() {
  if (coachWindowId === null) return;
  try {
    await chrome.windows.remove(coachWindowId);
  } catch {
    // ignore — already closed
  }
  coachWindowId = null;
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === coachWindowId) coachWindowId = null;
});

async function ensureOffscreen() {
  const hasApi = "offscreen" in chrome && chrome.offscreen;
  if (!hasApi) throw new Error("chrome.offscreen no disponible");
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.WEB_RTC],
    justification: "Captura audio de la pestana de la videollamada y lo envia al backend.",
  });
}

function updateStatus(status: CaptureStatus, message?: string) {
  snapshot.status = status;
  if (status === "error") snapshot.errorMessage = message;
  broadcast();
}

function broadcast() {
  chrome.runtime
    .sendMessage<ExtMessage>({ type: "snapshot", snapshot })
    .catch(() => {
      // no listeners
    });
}
