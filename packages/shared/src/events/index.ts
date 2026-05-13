import type {
  CallScorePayload,
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  Speaker,
  StageName,
  TranscriptSegmentPayload,
} from "../types";

export const ClientEvents = {
  SessionStart: "client:session.start",
  SessionEnd: "client:session.end",
  AudioChunk: "client:audio.chunk",
  TranscriptManualChunk: "client:transcript.manual_chunk",
  RecommendationDismiss: "client:recommendation.dismiss",
  RecommendationAccept: "client:recommendation.accept",
} as const;

export const ServerEvents = {
  SessionReady: "server:session.ready",
  TranscriptPartial: "server:transcript.partial",
  TranscriptFinal: "server:transcript.final",
  StageDetected: "server:stage.detected",
  SignalDetected: "server:signal.detected",
  RecommendationCreated: "server:recommendation.created",
  StateUpdated: "server:state.updated",
  SessionScoreUpdated: "server:session.score.updated",
  Error: "server:error",
} as const;

export interface ClientSessionStartPayload {
  sessionId: string;
  methodologyId?: string;
}

export interface ClientSessionEndPayload {
  sessionId: string;
}

export interface ClientTranscriptManualChunkPayload {
  sessionId: string;
  speaker: Speaker;
  text: string;
  isFinal: boolean;
}

export interface ClientAudioChunkPayload {
  sessionId: string;
  audioBase64: string;
  mimeType: string;
}

export interface ServerSessionReadyPayload {
  sessionId: string;
  stage: StageName;
  state: ConversationStatePayload;
}

export interface ServerTranscriptPayload {
  sessionId: string;
  segment: TranscriptSegmentPayload;
}

export interface ServerStageDetectedPayload {
  sessionId: string;
  stage: StageName;
  reason?: string;
}

export interface ServerSignalDetectedPayload {
  sessionId: string;
  signal: DetectedSignalPayload;
}

export interface ServerRecommendationCreatedPayload {
  sessionId: string;
  recommendation: LiveRecommendationPayload;
}

export interface ServerStateUpdatedPayload {
  sessionId: string;
  state: ConversationStatePayload;
}

export interface ServerScorePayload {
  sessionId: string;
  score: CallScorePayload;
}

export interface ServerErrorPayload {
  sessionId?: string;
  code: string;
  message: string;
}
