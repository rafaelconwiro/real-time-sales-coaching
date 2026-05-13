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
import { GeminiLiveService } from "../transcription/gemini-live.service";
import {
  ClientEvents,
  ServerEvents,
  type ClientAudioChunkPayload,
  type ClientSessionEndPayload,
  type ClientSessionStartPayload,
  type ClientTranscriptManualChunkPayload,
  type ServerRecommendationCreatedPayload,
  type ServerSessionReadyPayload,
  type ServerSignalDetectedPayload,
  type ServerStateUpdatedPayload,
  type ServerTranscriptPayload,
} from "@rtsc/shared";

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly socketSession = new Map<string, string>();
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
    const live = this.geminiLive.get(sessionId);
    if (live) {
      this.logger.log(`Closing Gemini Live for ${sessionId} (${reason})`);
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
  }

  @SubscribeMessage(ClientEvents.TranscriptManualChunk)
  async onManualChunk(
    @MessageBody() payload: ClientTranscriptManualChunkPayload,
    @ConnectedSocket() client: Socket,
  ) {
    await this.ingestText({
      sessionId: payload.sessionId,
      speaker: payload.speaker,
      text: payload.text,
      isFinal: payload.isFinal,
      client,
    });
  }

  private audioChunkCount = new Map<string, number>();

  @SubscribeMessage(ClientEvents.AudioChunk)
  async onAudioChunk(
    @MessageBody() payload: ClientAudioChunkPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.geminiLive.isEnabled()) {
      client.emit(ServerEvents.Error, {
        sessionId: payload.sessionId,
        code: "audio_disabled",
        message: "Gemini Live no configurado",
      });
      this.logger.warn(`Audio chunk dropped: Gemini Live disabled`);
      return;
    }
    let handle = this.geminiLive.get(payload.sessionId);
    if (!handle) {
      this.logger.log(`Opening Gemini Live session for ${payload.sessionId}`);
      handle = (await this.geminiLive.openSession({
        sessionId: payload.sessionId,
        onTranscript: async (text, isFinal) => {
          this.logger.debug(
            `[live ${payload.sessionId.slice(0, 8)}] transcript ${isFinal ? "final" : "partial"}: ${text.slice(0, 80)}`,
          );
          await this.ingestText({
            sessionId: payload.sessionId,
            speaker: "prospect",
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
      if (handle) {
        this.logger.log(`Gemini Live session OPEN for ${payload.sessionId}`);
      } else {
        this.logger.error(`Gemini Live openSession returned null for ${payload.sessionId}`);
      }
    }
    if (!handle) return;
    await handle.sendAudioChunk(payload.audioBase64, payload.mimeType);
    const count = (this.audioChunkCount.get(payload.sessionId) ?? 0) + 1;
    this.audioChunkCount.set(payload.sessionId, count);
    if (count === 1 || count % 50 === 0) {
      this.logger.debug(
        `[live ${payload.sessionId.slice(0, 8)}] forwarded ${count} audio chunks to Gemini`,
      );
    }
  }

  @SubscribeMessage(ClientEvents.SessionEnd)
  async onSessionEnd(@MessageBody() payload: ClientSessionEndPayload) {
    await this.cleanupSession(payload.sessionId, "end");
  }

  private async ingestText(input: {
    sessionId: string;
    speaker: ClientTranscriptManualChunkPayload["speaker"];
    text: string;
    isFinal: boolean;
    client: Socket;
  }) {
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
      const recPayload: ServerRecommendationCreatedPayload = {
        sessionId: input.sessionId,
        recommendation: result.recommendation,
      };
      this.server
        .to(this.room(input.sessionId))
        .emit(ServerEvents.RecommendationCreated, recPayload);
    }
  }

  private room(sessionId: string) {
    return `session:${sessionId}`;
  }
}
