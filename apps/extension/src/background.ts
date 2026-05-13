import type {
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
  sessionId: null,
  tabId: null,
  apiBase: "http://localhost:4000",
  state: null,
  recommendations: [],
  signals: [],
  recentSegments: [],
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
    // Tab navigated away. Stop capture to avoid orphan stream.
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

// Listen to socket events relayed from offscreen via chrome.runtime broadcast
chrome.runtime.onMessage.addListener((msg: any) => {
  if (!msg || typeof msg !== "object") return;
  switch (msg.type) {
    case "event:state":
      snapshot.state = msg.state as ConversationStatePayload;
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
    case "event:error":
      snapshot.status = "error";
      snapshot.errorMessage = msg.message;
      broadcast();
      break;
    case "event:ended":
      snapshot.status = "idle";
      broadcast();
      break;
  }
});

async function startCapture(streamId: string, tabId: number, precall: PrecallPayload) {
  if (snapshot.status === "live" || snapshot.status === "starting") return;
  snapshot.status = "starting";
  snapshot.errorMessage = undefined;
  snapshot.recommendations = [];
  snapshot.signals = [];
  snapshot.recentSegments = [];
  snapshot.tabId = tabId;
  broadcast();

  const apiBase = await getApiBase();
  snapshot.apiBase = apiBase;

  // Open side panel for the captured tab so user sees coaching in context.
  try {
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch {
    // ignore – side panel open is best-effort
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
  snapshot.status = "stopping";
  broadcast();
  try {
    await chrome.runtime.sendMessage<ExtMessage>({ type: "offscreen:stop" });
  } catch {
    // ignore — offscreen may already be gone
  }
  snapshot.status = "idle";
  snapshot.sessionId = null;
  broadcast();
}

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
      // no listeners — fine
    });
}
