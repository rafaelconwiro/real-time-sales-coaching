import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI, Modality } from "@google/genai";

export type LiveChannel = "seller" | "prospect" | "mixed";

interface LiveSessionHandle {
  sessionId: string;
  channel: LiveChannel;
  close: () => Promise<void>;
  sendAudioChunk: (audioBase64: string, mimeType: string) => Promise<void>;
}

interface OpenLiveParams {
  sessionId: string;
  channel?: LiveChannel;
  language?: string;
  onTranscript: (text: string, isFinal: boolean) => void | Promise<void>;
  onError: (err: Error) => void;
}

function key(sessionId: string, channel: LiveChannel) {
  return `${sessionId}:${channel}`;
}

@Injectable()
export class GeminiLiveService {
  private readonly logger = new Logger(GeminiLiveService.name);
  private readonly client?: GoogleGenAI;
  private readonly model: string;
  private readonly sessions = new Map<string, LiveSessionHandle>();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("google.apiKey");
    this.model =
      this.config.get<string>("google.liveModel") ?? "gemini-3.1-flash-live-preview";
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn("GOOGLE_API_KEY missing — Gemini Live audio disabled");
    }
  }

  isEnabled() {
    return !!this.client;
  }

  async openSession(params: OpenLiveParams): Promise<LiveSessionHandle | null> {
    if (!this.client) return null;
    const channel: LiveChannel = params.channel ?? "mixed";
    try {
      this.logger.log(`live.connect → model=${this.model} channel=${channel}`);

      const buffer = { text: "", lastChunkAt: 0 };
      let idleTimer: NodeJS.Timeout | null = null;
      const IDLE_FLUSH_MS = 1500;
      const MIN_FLUSH_CHARS = 8;

      const flush = async (reason: "turn" | "idle") => {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        const text = buffer.text.trim();
        if (text.length < MIN_FLUSH_CHARS) {
          buffer.text = "";
          return;
        }
        buffer.text = "";
        this.logger.debug(`flushing transcript (${reason}, ${text.length} chars): ${text.slice(0, 100)}`);
        await params.onTranscript(text, true);
      };

      const scheduleIdleFlush = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          void flush("idle");
        }, IDLE_FLUSH_MS);
      };

      const live = await this.client.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: {
            parts: [
              {
                text: "Eres un transcriptor pasivo. No hables. Solo transcribe el audio que recibes en el idioma original.",
              },
            ],
          },
        },
        callbacks: {
          onopen: () => this.logger.log(`Live session opened: ${params.sessionId}`),
          onmessage: async (msg: any) => {
            const inputTr = msg?.serverContent?.inputTranscription;
            const serverContent = msg?.serverContent;

            if (inputTr?.text) {
              buffer.text += inputTr.text;
              buffer.lastChunkAt = Date.now();
              scheduleIdleFlush();
              if (inputTr.finished) {
                await flush("turn");
              }
              return;
            }

            if (serverContent?.turnComplete || serverContent?.generationComplete) {
              await flush("turn");
              return;
            }

            if (msg?.setupComplete) {
              this.logger.log(`Live setup complete`);
            } else if (!serverContent?.modelTurn) {
              this.logger.debug(`live msg: ${JSON.stringify(msg).slice(0, 200)}`);
            }
          },
          onerror: (e: any) => {
            this.logger.error(`Live onerror: ${JSON.stringify(e).slice(0, 200)}`);
            params.onError(new Error(String(e?.message ?? e)));
          },
          onclose: (e: any) => {
            this.logger.warn(`Live onclose: ${JSON.stringify(e).slice(0, 200)}`);
            if (idleTimer) clearTimeout(idleTimer);
            this.sessions.delete(key(params.sessionId, channel));
          },
        },
      });

      const handle: LiveSessionHandle = {
        sessionId: params.sessionId,
        channel,
        close: async () => {
          try {
            live.close();
          } catch {
            // ignore
          }
          this.sessions.delete(key(params.sessionId, channel));
        },
        sendAudioChunk: async (audioBase64: string, mimeType: string) => {
          live.sendRealtimeInput({
            audio: { data: audioBase64, mimeType },
          });
        },
      };
      this.sessions.set(key(params.sessionId, channel), handle);
      return handle;
    } catch (err) {
      this.logger.error(`Gemini Live open failed: ${(err as Error).message}`);
      return null;
    }
  }

  get(sessionId: string, channel: LiveChannel = "mixed") {
    return this.sessions.get(key(sessionId, channel));
  }

  getAllForSession(sessionId: string) {
    const out: LiveSessionHandle[] = [];
    for (const [k, v] of this.sessions.entries()) {
      if (k.startsWith(`${sessionId}:`)) out.push(v);
    }
    return out;
  }

  async closeAll() {
    for (const h of this.sessions.values()) await h.close();
  }
}
