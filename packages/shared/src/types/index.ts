export type SessionChannel = "simulation" | "browser_audio" | "phone" | "video_call";
export type SessionStatus = "created" | "live" | "ended" | "failed";
export type Speaker = "seller" | "prospect" | "unknown";
export type CallTag = "won" | "lost" | "follow_up";
export type CallLanguage = "es" | "en";
export type CoachingStatus =
  | "idle"
  | "listening"
  | "analyzing"
  | "coaching"
  | "paused"
  | "error";

export type StageName =
  | "opening"
  | "discovery"
  | "qualification"
  | "solution_framing"
  | "objection_handling"
  | "closing"
  | "next_steps";

export type SignalType =
  | "buying_signal"
  | "risk_signal"
  | "missing_info"
  | "competitor"
  | "urgency"
  | "budget"
  | "objection";

export type RecommendationType =
  | "question"
  | "argument"
  | "warning"
  | "next_step"
  | "objection_response";

export type Priority = "low" | "medium" | "high";

export interface DetectedSignalPayload {
  id: string;
  type: SignalType;
  label: string;
  confidence: number;
  evidence: string;
  createdAt: string;
}

export interface LiveRecommendationPayload {
  id: string;
  type: RecommendationType;
  title: string;
  message: string;
  suggestedPhrase?: string | null;
  priority: Priority;
  reason: string;
  createdAt: string;
}

export interface TranscriptSegmentPayload {
  id: string;
  speaker: Speaker;
  text: string;
  isFinal: boolean;
  startMs?: number | null;
  endMs?: number | null;
  createdAt: string;
}

export interface ConversationStatePayload {
  stage: StageName;
  knownFields: Record<string, string | null>;
  missingFields: string[];
  recentSignals: DetectedSignalPayload[];
}

export interface CallScorePayload {
  overallScore: number;
  discoveryScore: number;
  qualificationScore: number;
  objectionScore: number;
  closingScore: number;
  methodologyAdherence: number;
  missingFields: string[];
  strengths: string[];
  improvements: string[];
}
