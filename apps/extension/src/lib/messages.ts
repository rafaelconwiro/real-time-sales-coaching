import type {
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";

export type CaptureStatus =
  | "idle"
  | "starting"
  | "live"
  | "stopping"
  | "error";

export interface CaptureSnapshot {
  status: CaptureStatus;
  sessionId: string | null;
  tabId: number | null;
  apiBase: string;
  errorMessage?: string;
  state: ConversationStatePayload | null;
  recommendations: LiveRecommendationPayload[];
  signals: DetectedSignalPayload[];
  recentSegments: TranscriptSegmentPayload[];
}

export interface PrecallPayload {
  methodologyId: string | null;
  script: string;
  prospectName: string;
  prospectCompany: string;
}

export type ExtMessage =
  | {
      type: "popup:start";
      streamId: string;
      tabId: number;
      precall: PrecallPayload;
    }
  | { type: "popup:stop" }
  | { type: "popup:get-snapshot" }
  | { type: "sidepanel:get-snapshot" }
  | { type: "offscreen:ready" }
  | { type: "offscreen:start"; sessionId: string; streamId: string; apiBase: string }
  | { type: "offscreen:stop" }
  | { type: "offscreen:status"; status: CaptureStatus; message?: string }
  | { type: "snapshot"; snapshot: CaptureSnapshot };

export type ExtResponse = { ok: true; data?: unknown } | { ok: false; error: string };
