import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI, Modality } from "@google/genai";

interface LiveSessionHandle {
  sessionId: string;
  close: () => Promise<void>;
  sendAudioChunk: (audioBase64: string, mimeType: string) => Promise<void>;
}

interface OpenLiveParams {
  sessionId: string;
  language?: string;
  onTranscript: (text: string, isFinal: boolean) => void | Promise<void>;
  onError: (err: Error) => void;
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
    try {
      this.logger.log(`live.connect → model=${this.model}`);
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
            const transcript = msg?.serverContent?.inputTranscription;
            const modelTurn = msg?.serverContent?.modelTurn;
            if (transcript?.text) {
              await params.onTranscript(transcript.text, !!transcript.finished);
            } else if (modelTurn) {
              this.logger.debug(`modelTurn (ignored): ${JSON.stringify(modelTurn).slice(0, 120)}`);
            } else if (msg?.setupComplete) {
              this.logger.log(`Live setup complete`);
            } else {
              this.logger.debug(`live msg: ${JSON.stringify(msg).slice(0, 200)}`);
            }
          },
          onerror: (e: any) => {
            this.logger.error(`Live onerror: ${JSON.stringify(e).slice(0, 200)}`);
            params.onError(new Error(String(e?.message ?? e)));
          },
          onclose: (e: any) => {
            this.logger.warn(`Live onclose: ${JSON.stringify(e).slice(0, 200)}`);
            this.sessions.delete(params.sessionId);
          },
        },
      });

      const handle: LiveSessionHandle = {
        sessionId: params.sessionId,
        close: async () => {
          try {
            live.close();
          } catch {
            // ignore
          }
          this.sessions.delete(params.sessionId);
        },
        sendAudioChunk: async (audioBase64: string, mimeType: string) => {
          live.sendRealtimeInput({
            audio: { data: audioBase64, mimeType },
          });
        },
      };
      this.sessions.set(params.sessionId, handle);
      return handle;
    } catch (err) {
      this.logger.error(`Gemini Live open failed: ${(err as Error).message}`);
      return null;
    }
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  async closeAll() {
    for (const h of this.sessions.values()) await h.close();
  }
}
