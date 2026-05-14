import type {
  CoachingStatus,
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";

export type CaptureStatus =
  | "idle"
  | "starting"
  | "live"
  | "paused"
  | "stopping"
  | "error";

export interface CaptureSnapshot {
  status: CaptureStatus;
  coachingStatus: CoachingStatus;
  sessionId: string | null;
  tabId: number | null;
  apiBase: string;
  errorMessage?: string;
  state: ConversationStatePayload | null;
  recommendations: LiveRecommendationPayload[];
  signals: DetectedSignalPayload[];
  recentSegments: TranscriptSegmentPayload[];
  exitCriteria: string | null;
}

export interface PrecallPayload {
  methodologyId: string | null;
  prospectId: string | null;
  language: "es" | "en";
  script: string;
  prospectName: string;
  prospectCompany: string;
  prospectNotes: string;
}

export type ExtMessage =
  | {
      type: "popup:start";
      streamId: string;
      tabId: number;
      precall: PrecallPayload;
    }
  | { type: "popup:stop" }
  | { type: "popup:pause" }
  | { type: "popup:resume" }
  | { type: "popup:get-snapshot" }
  | { type: "sidepanel:get-snapshot" }
  | { type: "coach-window:toggle" }
  | { type: "coach-window:close" }
  | { type: "offscreen:ready" }
  | { type: "offscreen:start"; sessionId: string; streamId: string; apiBase: string }
  | { type: "offscreen:stop" }
  | { type: "offscreen:pause" }
  | { type: "offscreen:resume" }
  | { type: "offscreen:status"; status: CaptureStatus; message?: string }
  | { type: "snapshot"; snapshot: CaptureSnapshot };

export type ExtResponse = { ok: true; data?: unknown } | { ok: false; error: string };
