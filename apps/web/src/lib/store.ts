"use client";

import { create } from "zustand";
import type {
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveRecommendationPayload,
  TranscriptSegmentPayload,
} from "@rtsc/shared";

interface CopilotStore {
  sessionId: string | null;
  state: ConversationStatePayload | null;
  segments: TranscriptSegmentPayload[];
  signals: DetectedSignalPayload[];
  recommendations: LiveRecommendationPayload[];
  setSessionId: (id: string | null) => void;
  setState: (s: ConversationStatePayload) => void;
  pushSegment: (s: TranscriptSegmentPayload) => void;
  pushSignal: (s: DetectedSignalPayload) => void;
  pushRecommendation: (r: LiveRecommendationPayload) => void;
  reset: () => void;
}

export const useCopilotStore = create<CopilotStore>((set) => ({
  sessionId: null,
  state: null,
  segments: [],
  signals: [],
  recommendations: [],
  setSessionId: (id) => set({ sessionId: id }),
  setState: (s) => set({ state: s }),
  pushSegment: (s) =>
    set((prev) => ({ segments: [...prev.segments, s].slice(-200) })),
  pushSignal: (s) =>
    set((prev) => ({ signals: [...prev.signals, s].slice(-50) })),
  pushRecommendation: (r) =>
    set((prev) => ({ recommendations: [r, ...prev.recommendations].slice(0, 20) })),
  reset: () =>
    set({ sessionId: null, state: null, segments: [], signals: [], recommendations: [] }),
}));
