import { io, Socket } from "socket.io-client";
import { ClientEvents, ServerEvents } from "@rtsc/shared";
import type {
  CoachingStatus,
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  ServerRecommendationCreatedPayload,
  ServerSessionPausedPayload,
  ServerSessionReadyPayload,
  ServerSessionResumedPayload,
  ServerSignalDetectedPayload,
  ServerStageDetectedPayload,
  ServerStatusChangedPayload,
  ServerStateUpdatedPayload,
  ServerTranscriptPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";
import { arrayBufferToBase64, floatToPcm16 } from "./lib/pcm";
import type { ExtMessage } from "./lib/messages";

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600;

type Channel = "seller" | "prospect";

interface ChannelHandle {
  source: MediaStreamAudioSourceNode;
  worklet: AudioWorkletNode;
}

interface RuntimeState {
  socket: Socket | null;
  ctx: AudioContext | null;
  passthroughGain: GainNode | null;
  micStream: MediaStream | null;
  tabStream: MediaStream | null;
  channels: Map<Channel, ChannelHandle>;
  sessionId: string | null;
  apiBase: string | null;
  paused: boolean;
}

const rt: RuntimeState = {
  socket: null,
  ctx: null,
  passthroughGain: null,
  micStream: null,
  tabStream: null,
  channels: new Map(),
  sessionId: null,
  apiBase: null,
  paused: false,
};

chrome.runtime.onMessage.addListener(
  (msg: ExtMessage, _sender, sendResponse: (r: unknown) => void) => {
    (async () => {
      try {
        if (msg.type === "offscreen:start") {
          await start(msg.sessionId, msg.streamId, msg.apiBase);
          sendResponse({ ok: true });
        } else if (msg.type === "offscreen:stop") {
          await stop();
          sendResponse({ ok: true });
        } else if (msg.type === "offscreen:pause") {
          pause();
          sendResponse({ ok: true });
        } else if (msg.type === "offscreen:resume") {
          resume();
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "unknown" });
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        report("error", m);
        sendResponse({ ok: false, error: m });
      }
    })();
    return true;
  },
);

chrome.runtime
  .sendMessage<ExtMessage>({ type: "offscreen:ready" })
  .catch(() => {});

async function start(sessionId: string, streamId: string, apiBase: string) {
  await stop();
  rt.sessionId = sessionId;
  rt.apiBase = apiBase;
  rt.paused = false;

  report("starting");

  rt.tabStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error - Chrome-specific
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    },
    video: false,
  });
  try {
    rt.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    console.warn("Mic capture failed:", err);
    rt.micStream = null;
  }

  rt.ctx = new AudioContext({ sampleRate: 48000 });
  await rt.ctx.audioWorklet.addModule("audio-worklet.js");

  rt.passthroughGain = rt.ctx.createGain();
  rt.passthroughGain.gain.value = 1.0;
  const tabSourceForPlayback = rt.ctx.createMediaStreamSource(rt.tabStream);
  tabSourceForPlayback.connect(rt.passthroughGain).connect(rt.ctx.destination);

  rt.socket = io(apiBase, { transports: ["websocket"], reconnection: true });
  attachSocketHandlers(rt.socket, sessionId);

  await setupChannel("prospect", rt.tabStream, 1.0);
  if (rt.micStream) await setupChannel("seller", rt.micStream, 1.5);

  console.log(
    `[offscreen] start sessionId=${sessionId} channels=${[...rt.channels.keys()].join(",")}`,
  );
  report("live");
}

async function setupChannel(channel: Channel, stream: MediaStream, gain: number) {
  if (!rt.ctx) return;
  const source = rt.ctx.createMediaStreamSource(stream);
  const gainNode = rt.ctx.createGain();
  gainNode.channelCount = 1;
  gainNode.channelCountMode = "explicit";
  gainNode.gain.value = gain;
  const worklet = new AudioWorkletNode(rt.ctx, "pcm16-downsampler", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    processorOptions: { targetSampleRate: TARGET_SAMPLE_RATE, chunkSamples: CHUNK_SAMPLES },
  });
  source.connect(gainNode).connect(worklet);

  worklet.port.onmessage = (ev) => {
    if (!rt.socket || rt.socket.disconnected) return;
    if (rt.paused) return;
    const floats = ev.data as Float32Array;
    const pcm16 = floatToPcm16(floats);
    const audioBase64 = arrayBufferToBase64(pcm16.buffer);
    rt.socket.emit(ClientEvents.AudioChunk, {
      sessionId: rt.sessionId,
      audioBase64,
      mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
      channel,
    });
  };
  rt.channels.set(channel, { source, worklet });
}

function attachSocketHandlers(socket: Socket, sessionId: string) {
  socket.on("connect", () => {
    socket.emit(ClientEvents.SessionStart, { sessionId });
  });
  socket.on(ServerEvents.SessionReady, (p: ServerSessionReadyPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:session-ready", sessionId: p.sessionId, state: p.state })
      .catch(() => {});
  });
  socket.on(ServerEvents.StateUpdated, (p: ServerStateUpdatedPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:state", state: p.state as ConversationStatePayload })
      .catch(() => {});
  });
  socket.on(ServerEvents.StatusChanged, (p: ServerStatusChangedPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:status", status: p.status as CoachingStatus })
      .catch(() => {});
  });
  socket.on(ServerEvents.StageDetected, (p: ServerStageDetectedPayload) => {
    void fetchExitCriteriaForStage(sessionId, p.stage);
  });
  socket.on(ServerEvents.RecommendationCreated, (p: ServerRecommendationCreatedPayload) => {
    chrome.runtime
      .sendMessage({
        type: "event:recommendation",
        recommendation: p.recommendation as LiveRecommendationPayload,
      })
      .catch(() => {});
  });
  socket.on(ServerEvents.SignalDetected, (p: ServerSignalDetectedPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:signal", signal: p.signal as DetectedSignalPayload })
      .catch(() => {});
  });
  socket.on(ServerEvents.TranscriptFinal, (p: ServerTranscriptPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:transcript", segment: p.segment as TranscriptSegmentPayload })
      .catch(() => {});
  });
  socket.on(ServerEvents.TranscriptPartial, (p: ServerTranscriptPayload) => {
    chrome.runtime
      .sendMessage({ type: "event:transcript", segment: p.segment as TranscriptSegmentPayload })
      .catch(() => {});
  });
  socket.on(ServerEvents.SessionPaused, (_p: ServerSessionPausedPayload) => {
    chrome.runtime.sendMessage({ type: "event:paused" }).catch(() => {});
  });
  socket.on(ServerEvents.SessionResumed, (_p: ServerSessionResumedPayload) => {
    chrome.runtime.sendMessage({ type: "event:resumed" }).catch(() => {});
  });
  socket.on(ServerEvents.Error, (p: any) => {
    report("error", p?.message ?? "error desconocido");
  });
  socket.on("connect_error", (err) => {
    report("error", `WS connect error: ${err.message}`);
  });
}

async function fetchExitCriteriaForStage(sessionId: string, stage: string) {
  if (!rt.apiBase) return;
  try {
    const res = await fetch(`${rt.apiBase}/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    const stages = data?.methodology?.stages ?? [];
    const match = stages.find((s: any) => s.name === stage);
    chrome.runtime
      .sendMessage({ type: "event:exit-criteria", exitCriteria: match?.exitCriteria ?? null })
      .catch(() => {});
  } catch {
    // ignore
  }
}

function pause() {
  rt.paused = true;
  if (rt.socket) rt.socket.emit(ClientEvents.SessionPause, { sessionId: rt.sessionId });
  report("paused");
}

function resume() {
  rt.paused = false;
  if (rt.socket) rt.socket.emit(ClientEvents.SessionResume, { sessionId: rt.sessionId });
  report("live");
}

async function stop() {
  try {
    if (rt.socket && rt.sessionId) {
      rt.socket.emit(ClientEvents.SessionEnd, { sessionId: rt.sessionId });
    }
  } catch {
    // ignore
  }
  for (const { worklet } of rt.channels.values()) worklet.disconnect();
  rt.channels.clear();
  rt.passthroughGain?.disconnect();
  rt.tabStream?.getTracks().forEach((t) => t.stop());
  rt.micStream?.getTracks().forEach((t) => t.stop());
  if (rt.ctx && rt.ctx.state !== "closed") {
    try {
      await rt.ctx.close();
    } catch {
      // ignore
    }
  }
  rt.socket?.disconnect();

  rt.passthroughGain = null;
  rt.tabStream = null;
  rt.micStream = null;
  rt.ctx = null;
  rt.socket = null;
  rt.sessionId = null;
  rt.paused = false;

  chrome.runtime.sendMessage({ type: "event:ended" }).catch(() => {});
  report("idle");
}

function report(
  status: "idle" | "starting" | "live" | "paused" | "stopping" | "error",
  message?: string,
) {
  chrome.runtime
    .sendMessage<ExtMessage>({ type: "offscreen:status", status, message })
    .catch(() => {});
}
