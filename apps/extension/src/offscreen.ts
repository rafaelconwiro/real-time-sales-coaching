import { io, Socket } from "socket.io-client";
import { ClientEvents, ServerEvents } from "@rtsc/shared";
import type {
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  ServerRecommendationCreatedPayload,
  ServerSessionReadyPayload,
  ServerSignalDetectedPayload,
  ServerStateUpdatedPayload,
  ServerTranscriptPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";
import { arrayBufferToBase64, floatToPcm16 } from "./lib/pcm";
import type { ExtMessage } from "./lib/messages";

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms @ 16kHz

interface RuntimeState {
  socket: Socket | null;
  ctx: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  worklet: AudioWorkletNode | null;
  micStream: MediaStream | null;
  tabStream: MediaStream | null;
  sessionId: string | null;
  apiBase: string | null;
  passthroughGain: GainNode | null;
}

const rt: RuntimeState = {
  socket: null,
  ctx: null,
  source: null,
  worklet: null,
  micStream: null,
  tabStream: null,
  sessionId: null,
  apiBase: null,
  passthroughGain: null,
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

  report("starting");

  rt.tabStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error - Chrome-specific constraints
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  try {
    rt.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    console.warn("Mic capture failed (continuing with tab audio only):", err);
    rt.micStream = null;
  }

  rt.ctx = new AudioContext({ sampleRate: 48000 });
  await rt.ctx.audioWorklet.addModule("audio-worklet.js");

  // Force mono sum: mixer with channelCount=1, explicit downmix.
  const mixer = rt.ctx.createGain();
  mixer.channelCount = 1;
  mixer.channelCountMode = "explicit";
  mixer.channelInterpretation = "speakers";
  mixer.gain.value = 1.0;

  const tabSource = rt.ctx.createMediaStreamSource(rt.tabStream);
  const tabGain = rt.ctx.createGain();
  tabGain.channelCount = 1;
  tabGain.channelCountMode = "explicit";
  tabGain.gain.value = 1.0;
  tabSource.connect(tabGain).connect(mixer);

  // Passthrough so user keeps hearing meeting audio.
  rt.passthroughGain = rt.ctx.createGain();
  rt.passthroughGain.gain.value = 1.0;
  tabSource.connect(rt.passthroughGain).connect(rt.ctx.destination);

  if (rt.micStream) {
    const micSource = rt.ctx.createMediaStreamSource(rt.micStream);
    const micGain = rt.ctx.createGain();
    micGain.channelCount = 1;
    micGain.channelCountMode = "explicit";
    micGain.gain.value = 1.5;
    micSource.connect(micGain).connect(mixer);
  }

  rt.worklet = new AudioWorkletNode(rt.ctx, "pcm16-downsampler", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    processorOptions: {
      targetSampleRate: TARGET_SAMPLE_RATE,
      chunkSamples: CHUNK_SAMPLES,
    },
  });
  mixer.connect(rt.worklet);

  rt.socket = io(apiBase, {
    transports: ["websocket"],
    reconnection: true,
  });
  attachSocketHandlers(rt.socket, sessionId);

  let chunkCount = 0;
  let lastLog = Date.now();
  let peakSinceLog = 0;
  rt.worklet.port.onmessage = (ev) => {
    if (!rt.socket || rt.socket.disconnected) return;
    const floats = ev.data as Float32Array;
    let peak = 0;
    for (let i = 0; i < floats.length; i++) {
      const v = Math.abs(floats[i] ?? 0);
      if (v > peak) peak = v;
    }
    if (peak > peakSinceLog) peakSinceLog = peak;
    const pcm16 = floatToPcm16(floats);
    const audioBase64 = arrayBufferToBase64(pcm16.buffer);
    rt.socket.emit(ClientEvents.AudioChunk, {
      sessionId,
      audioBase64,
      mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
    });
    chunkCount++;
    const now = Date.now();
    if (now - lastLog > 3000) {
      console.log(
        `[offscreen] chunks=${chunkCount} peak=${peakSinceLog.toFixed(3)} mic=${rt.micStream ? "ok" : "none"}`,
      );
      lastLog = now;
      peakSinceLog = 0;
    }
  };

  console.log(
    `[offscreen] start sessionId=${sessionId} ctxRate=${rt.ctx.sampleRate} mic=${rt.micStream ? "ok" : "none"}`,
  );
  report("live");
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

  socket.on(ServerEvents.Error, (p: any) => {
    report("error", p?.message ?? "error desconocido");
  });

  socket.on("connect_error", (err) => {
    report("error", `WS connect error: ${err.message}`);
  });
}

async function stop() {
  try {
    if (rt.socket && rt.sessionId) {
      rt.socket.emit(ClientEvents.SessionEnd, { sessionId: rt.sessionId });
    }
  } catch {
    // ignore
  }
  rt.worklet?.disconnect();
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

  rt.worklet = null;
  rt.passthroughGain = null;
  rt.tabStream = null;
  rt.micStream = null;
  rt.ctx = null;
  rt.socket = null;
  rt.sessionId = null;

  chrome.runtime.sendMessage({ type: "event:ended" }).catch(() => {});
  report("idle");
}

function report(status: "idle" | "starting" | "live" | "stopping" | "error", message?: string) {
  chrome.runtime
    .sendMessage<ExtMessage>({ type: "offscreen:status", status, message })
    .catch(() => {});
}
