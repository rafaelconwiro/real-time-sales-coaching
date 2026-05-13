import { Injectable } from "@nestjs/common";
import type { StageName } from "@rtsc/shared";

export interface SessionState {
  stage: StageName;
  knownFields: Record<string, string | null>;
  missingFields: string[];
  recentSegments: { speaker: string; text: string; createdAt: number }[];
  recentSignals: { type: string; label: string; createdAt: number }[];
  recentRecommendationKeys: Map<string, number>;
}

const RECENT_WINDOW = 12;
const DUPLICATE_COOLDOWN_MS = 60_000;

@Injectable()
export class ConversationStateService {
  private readonly sessions = new Map<string, SessionState>();

  init(sessionId: string, requiredFields: string[]): SessionState {
    const state: SessionState = {
      stage: "opening",
      knownFields: Object.fromEntries(requiredFields.map((f) => [f, null])),
      missingFields: [...requiredFields],
      recentSegments: [],
      recentSignals: [],
      recentRecommendationKeys: new Map(),
    };
    this.sessions.set(sessionId, state);
    return state;
  }

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getOrInit(sessionId: string, requiredFields: string[]): SessionState {
    return this.sessions.get(sessionId) ?? this.init(sessionId, requiredFields);
  }

  pushSegment(sessionId: string, speaker: string, text: string) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.recentSegments.push({ speaker, text, createdAt: Date.now() });
    if (state.recentSegments.length > RECENT_WINDOW) {
      state.recentSegments.splice(0, state.recentSegments.length - RECENT_WINDOW);
    }
  }

  updateKnownFields(sessionId: string, fields: Record<string, string | null>) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    for (const [k, v] of Object.entries(fields)) {
      if (v && state.knownFields[k] !== v) {
        state.knownFields[k] = v;
      }
    }
    state.missingFields = Object.keys(state.knownFields).filter(
      (k) => !state.knownFields[k],
    );
  }

  setStage(sessionId: string, stage: StageName) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.stage = stage;
  }

  recordSignal(sessionId: string, type: string, label: string) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.recentSignals.push({ type, label, createdAt: Date.now() });
    if (state.recentSignals.length > RECENT_WINDOW) {
      state.recentSignals.splice(0, state.recentSignals.length - RECENT_WINDOW);
    }
  }

  shouldEmitRecommendation(sessionId: string, key: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return true;
    const last = state.recentRecommendationKeys.get(key);
    const now = Date.now();
    if (last && now - last < DUPLICATE_COOLDOWN_MS) return false;
    state.recentRecommendationKeys.set(key, now);
    return true;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
