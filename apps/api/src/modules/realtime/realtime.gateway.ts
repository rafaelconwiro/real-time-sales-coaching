import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CallSessionsService } from "../call-sessions/call-sessions.service";
import { RecommendationService } from "../recommendations/recommendation.service";
import { ScoringService } from "../scoring/scoring.service";
import { GeminiLiveService, type LiveChannel } from "../transcription/gemini-live.service";
import {
  ClientEvents,
  ServerEvents,
  type ClientAudioChunkPayload,
  type ClientSessionEndPayload,
  type ClientSessionPausePayload,
  type ClientSessionResumePayload,
  type ClientSessionStartPayload,
  type ClientTranscriptManualChunkPayload,
  type CoachingStatus,
  type ServerPauseDetectedPayload,
  type ServerRecommendationCreatedPayload,
  type ServerSessionPausedPayload,
  type ServerSessionResumedPayload,
  type ServerSessionReadyPayload,
  type ServerSignalDetectedPayload,
  type ServerStateUpdatedPayload,
  type ServerStatusChangedPayload,
  type ServerTranscriptPayload,
  type Speaker,
} from "@rtsc/shared";

const PAUSE_THRESHOLD_MS = 8000;

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly socketSession = new Map<string, string>();
  private readonly paused = new Set<string>();
  private readonly lastSegmentAt = new Map<string, number>();
  private readonly audioChunkCount = new Map<string, number>();
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: CallSessionsService,
    private readonly recommendations: RecommendationService,
    private readonly scoring: ScoringService,
    private readonly geminiLive: GeminiLiveService,
  ) {}

  afterInit() {
    this.logger.log("Realtime gateway ready");
  }

  async handleDisconnect(client: Socket) {
    const sessionId = this.socketSession.get(client.id);
    this.socketSession.delete(client.id);
    this.logger.debug(`client disconnect ${client.id} sessionId=${sessionId ?? "none"}`);
    if (!sessionId) return;
    await this.cleanupSession(sessionId, "disconnect");
  }

  private async cleanupSession(sessionId: string, reason: "disconnect" | "end") {
    this.audioChunkCount.delete(sessionId);
    this.paused.delete(sessionId);
    this.lastSegmentAt.delete(sessionId);
    const lives = this.geminiLive.getAllForSession(sessionId);
    for (const live of lives) {
      this.logger.log(`Closing Gemini Live for ${sessionId} ch=${live.channel} (${reason})`);
      try {
        await live.close();
      } catch (err) {
        this.logger.warn(`Live close error: ${(err as Error).message}`);
      }
    }
    try {
      await this.sessions.end(sessionId);
    } catch {
      // already ended
    }
    if (reason === "end") {
      this.emitStatus(sessionId, "idle");
      try {
        const summary = await this.scoring.finalize(sessionId);
        this.server.to(this.room(sessionId)).emit(ServerEvents.SessionScoreUpdated, {
          sessionId,
          score: summary
            ? {
                overallScore: summary.score.overallScore,
                discoveryScore: summary.score.discoveryScore,
                qualificationScore: summary.score.qualificationScore,
                objectionScore: summary.score.objectionScore,
                closingScore: summary.score.closingScore,
                methodologyAdherence: summary.score.methodologyAdherence,
                missingFields: summary.missingFields,
                strengths: summary.score.strengths,
                improvements: summary.score.improvements,
              }
            : null,
        });
      } catch (err) {
        this.logger.warn(`Scoring finalize failed: ${(err as Error).message}`);
      }
    }
  }

  @SubscribeMessage(ClientEvents.SessionStart)
  async onSessionStart(
    @MessageBody() payload: ClientSessionStartPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const session = await this.sessions.findById(payload.sessionId);
    await client.join(this.room(session.id));
    this.socketSession.set(client.id, session.id);
    const state = await this.recommendations.ensureState(session.id, session.methodologyId);
    const ready: ServerSessionReadyPayload = {
      sessionId: session.id,
      stage: state.stage,
      state: {
        stage: state.stage,
        knownFields: state.knownFields,
        missingFields: state.missingFields,
        recentSignals: [],
      },
    };
    client.emit(ServerEvents.SessionReady, ready);
    this.emitStatus(session.id, "listening");
  }

  @SubscribeMessage(ClientEvents.SessionPause)
  async onSessionPause(@MessageBody() payload: ClientSessionPausePayload) {
    this.paused.add(payload.sessionId);
    const at = new Date().toISOString();
    const event: ServerSessionPausedPayload = { sessionId: payload.sessionId, at };
    this.server.to(this.room(payload.sessionId)).emit(ServerEvents.SessionPaused, event);
    this.emitStatus(payload.sessionId, "paused");
  }

  @SubscribeMessage(ClientEvents.SessionResume)
  async onSessionResume(@MessageBody() payload: ClientSessionResumePayload) {
    this.paused.delete(payload.sessionId);
    this.lastSegmentAt.set(payload.sessionId, Date.now());
    const at = new Date().toISOString();
    const event: ServerSessionResumedPayload = { sessionId: payload.sessionId, at };
    this.server.to(this.room(payload.sessionId)).emit(ServerEvents.SessionResumed, event);
    this.emitStatus(payload.sessionId, "listening");
  }

  @SubscribeMessage(ClientEvents.TranscriptManualChunk)
  async onManualChunk(
    @MessageBody() payload: ClientTranscriptManualChunkPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (this.paused.has(payload.sessionId)) return;
    await this.ingestText({
      sessionId: payload.sessionId,
      speaker: payload.speaker,
      text: payload.text,
      isFinal: payload.isFinal,
      client,
    });
  }

  @SubscribeMessage(ClientEvents.AudioChunk)
  async onAudioChunk(
    @MessageBody() payload: ClientAudioChunkPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (this.paused.has(payload.sessionId)) return;
    if (!this.geminiLive.isEnabled()) {
      client.emit(ServerEvents.Error, {
        sessionId: payload.sessionId,
        code: "audio_disabled",
        message: "Gemini Live no configurado",
      });
      this.logger.warn(`Audio chunk dropped: Gemini Live disabled`);
      return;
    }
    const channel: LiveChannel = (payload.channel ?? "mixed") as LiveChannel;
    let handle = this.geminiLive.get(payload.sessionId, channel);
    if (!handle) {
      const speakerForChannel: Speaker =
        channel === "seller" ? "seller" : channel === "prospect" ? "prospect" : "unknown";
      this.logger.log(`Opening Gemini Live for ${payload.sessionId} ch=${channel}`);
      handle = (await this.geminiLive.openSession({
        sessionId: payload.sessionId,
        channel,
        onTranscript: async (text, isFinal) => {
          await this.ingestText({
            sessionId: payload.sessionId,
            speaker: speakerForChannel,
            text,
            isFinal,
            client,
          });
        },
        onError: (err) => {
          this.logger.error(`Gemini Live error: ${err.message}`);
          client.emit(ServerEvents.Error, {
            sessionId: payload.sessionId,
            code: "live_error",
            message: err.message,
          });
        },
      })) ?? undefined;
    }
    if (!handle) return;
    await handle.sendAudioChunk(payload.audioBase64, payload.mimeType);
    const countKey = `${payload.sessionId}:${channel}`;
    const count = (this.audioChunkCount.get(countKey) ?? 0) + 1;
    this.audioChunkCount.set(countKey, count);
    if (count === 1 || count % 100 === 0) {
      this.logger.debug(`[live ${payload.sessionId.slice(0, 8)}/${channel}] ${count} chunks`);
    }
  }

  @SubscribeMessage(ClientEvents.SessionEnd)
  async onSessionEnd(@MessageBody() payload: ClientSessionEndPayload) {
    await this.cleanupSession(payload.sessionId, "end");
  }

  private async ingestText(input: {
    sessionId: string;
    speaker: Speaker;
    text: string;
    isFinal: boolean;
    client: Socket;
  }) {
    const now = Date.now();
    const last = this.lastSegmentAt.get(input.sessionId);
    if (last && now - last > PAUSE_THRESHOLD_MS) {
      const event: ServerPauseDetectedPayload = {
        sessionId: input.sessionId,
        durationMs: now - last,
        at: new Date(now).toISOString(),
      };
      this.server.to(this.room(input.sessionId)).emit(ServerEvents.PauseDetected, event);
    }
    this.lastSegmentAt.set(input.sessionId, now);

    const segment = await this.prisma.transcriptSegment.create({
      data: {
        callSessionId: input.sessionId,
        speaker: input.speaker,
        text: input.text,
        isFinal: input.isFinal,
      },
    });
    const transcriptPayload: ServerTranscriptPayload = {
      sessionId: input.sessionId,
      segment: {
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        isFinal: segment.isFinal,
        startMs: segment.startMs,
        endMs: segment.endMs,
        createdAt: segment.createdAt.toISOString(),
      },
    };
    this.server
      .to(this.room(input.sessionId))
      .emit(
        input.isFinal ? ServerEvents.TranscriptFinal : ServerEvents.TranscriptPartial,
        transcriptPayload,
      );

    if (!input.isFinal) return;

    this.emitStatus(input.sessionId, "analyzing");

    const session = await this.prisma.callSession.findUnique({
      where: { id: input.sessionId },
      select: { methodologyId: true },
    });

    const result = await this.recommendations.analyzeAfterSegment({
      sessionId: input.sessionId,
      methodologyId: session?.methodologyId,
      segmentId: segment.id,
      speaker: input.speaker,
      text: input.text,
    });

    const statePayload: ServerStateUpdatedPayload = {
      sessionId: input.sessionId,
      state: result.state,
    };
    this.server.to(this.room(input.sessionId)).emit(ServerEvents.StateUpdated, statePayload);

    if (result.stageChanged) {
      this.server
        .to(this.room(input.sessionId))
        .emit(ServerEvents.StageDetected, {
          sessionId: input.sessionId,
          stage: result.state.stage,
        });
    }

    for (const signal of result.newSignals) {
      const signalPayload: ServerSignalDetectedPayload = {
        sessionId: input.sessionId,
        signal,
      };
      this.server.to(this.room(input.sessionId)).emit(ServerEvents.SignalDetected, signalPayload);
    }

    if (result.recommendation) {
      this.emitStatus(input.sessionId, "coaching");
      const recPayload: ServerRecommendationCreatedPayload = {
        sessionId: input.sessionId,
        recommendation: result.recommendation,
      };
      this.server
        .to(this.room(input.sessionId))
        .emit(ServerEvents.RecommendationCreated, recPayload);
      setTimeout(() => this.emitStatus(input.sessionId, "listening"), 2000);
    } else {
      this.emitStatus(input.sessionId, "listening");
    }
  }

  private emitStatus(sessionId: string, status: CoachingStatus) {
    const payload: ServerStatusChangedPayload = { sessionId, status };
    this.server.to(this.room(sessionId)).emit(ServerEvents.StatusChanged, payload);
  }

  private room(sessionId: string) {
    return `session:${sessionId}`;
  }
}
