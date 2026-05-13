import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PlaybooksService } from "../playbooks/playbooks.service";
import { ConversationStateService } from "./conversation-state.service";
import { RulesEngineService } from "./rules-engine.service";
import { LiveAnalysisService } from "./live-analysis.service";
import type {
  ConversationStatePayload,
  DetectedSignalPayload,
  LiveAnalysisResponse,
  LiveRecommendationPayload,
  StageName,
} from "@rtsc/shared";

interface AnalyzeResult {
  state: ConversationStatePayload;
  newSignals: DetectedSignalPayload[];
  recommendation?: LiveRecommendationPayload;
  stageChanged: boolean;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly playbooks: PlaybooksService,
    private readonly conversation: ConversationStateService,
    private readonly rules: RulesEngineService,
    private readonly live: LiveAnalysisService,
  ) {}

  async ensureState(sessionId: string, methodologyId?: string | null) {
    const requiredFields = await this.requiredFieldsFor(methodologyId);
    return this.conversation.getOrInit(sessionId, requiredFields);
  }

  private async requiredFieldsFor(methodologyId?: string | null): Promise<string[]> {
    if (!methodologyId) return ["pain", "impact", "budget", "decisionMaker", "timeline"];
    const m = await this.playbooks.findById(methodologyId);
    const set = new Set<string>();
    for (const s of m.stages) for (const f of s.requiredFields) set.add(f);
    if (set.size === 0) ["pain", "impact", "budget", "decisionMaker", "timeline"].forEach((f) => set.add(f));
    return [...set];
  }

  async analyzeAfterSegment(params: {
    sessionId: string;
    methodologyId?: string | null;
    segmentId: string;
    speaker: string;
    text: string;
  }): Promise<AnalyzeResult> {
    const state = await this.ensureState(params.sessionId, params.methodologyId);
    this.conversation.pushSegment(params.sessionId, params.speaker, params.text);

    const playbook = params.methodologyId
      ? await this.playbookSnapshot(params.methodologyId)
      : { name: "default", stages: [], objections: [], signals: [] };

    const sessionMeta = await this.prisma.callSession.findUnique({
      where: { id: params.sessionId },
      select: { script: true, prospectName: true, prospectCompany: true },
    });

    const recent = state.recentSegments;
    const recentText = recent.map((r) => r.text).join("\n");

    let analysis: LiveAnalysisResponse | null = null;
    if (this.live.isEnabled()) {
      analysis = await this.live.analyze({
        currentStage: state.stage,
        knownFields: state.knownFields,
        recentSegments: recent.map((s) => ({ speaker: s.speaker, text: s.text })),
        playbook,
        script: sessionMeta?.script ?? null,
        prospectName: sessionMeta?.prospectName ?? null,
        prospectCompany: sessionMeta?.prospectCompany ?? null,
      });
    }
    if (!analysis) {
      analysis = this.rules.analyze(
        recentText,
        { stages: playbook.stages, objections: playbook.objections },
        state.stage,
      );
    }

    const previousStage = state.stage;
    this.conversation.setStage(params.sessionId, analysis.stage as StageName);
    this.conversation.updateKnownFields(params.sessionId, analysis.knownFields);

    const newSignals: DetectedSignalPayload[] = [];
    for (const sig of analysis.detectedSignals) {
      this.conversation.recordSignal(params.sessionId, sig.type, sig.label);
      const saved = await this.prisma.detectedSignal.create({
        data: {
          callSessionId: params.sessionId,
          transcriptSegmentId: params.segmentId,
          type: sig.type as never,
          label: sig.label,
          confidence: sig.confidence,
          evidence: sig.evidence,
        },
      });
      newSignals.push({
        id: saved.id,
        type: saved.type as DetectedSignalPayload["type"],
        label: saved.label,
        confidence: saved.confidence,
        evidence: saved.evidence,
        createdAt: saved.createdAt.toISOString(),
      });
    }

    let recommendation: LiveRecommendationPayload | undefined;
    if (analysis.recommendation) {
      const key = `${analysis.recommendation.type}:${analysis.recommendation.title}`;
      if (this.conversation.shouldEmitRecommendation(params.sessionId, key)) {
        const saved = await this.prisma.liveRecommendation.create({
          data: {
            callSessionId: params.sessionId,
            type: analysis.recommendation.type as never,
            title: analysis.recommendation.title,
            message: analysis.recommendation.message,
            suggestedPhrase: analysis.recommendation.suggestedPhrase ?? null,
            priority: analysis.recommendation.priority as never,
            reason: analysis.recommendation.reason,
          },
        });
        recommendation = {
          id: saved.id,
          type: saved.type as LiveRecommendationPayload["type"],
          title: saved.title,
          message: saved.message,
          suggestedPhrase: saved.suggestedPhrase,
          priority: saved.priority as LiveRecommendationPayload["priority"],
          reason: saved.reason,
          createdAt: saved.createdAt.toISOString(),
        };
      }
    }

    const updatedState = this.conversation.get(params.sessionId)!;
    const statePayload: ConversationStatePayload = {
      stage: updatedState.stage,
      knownFields: { ...updatedState.knownFields },
      missingFields: [...updatedState.missingFields],
      recentSignals: updatedState.recentSignals.slice(-6).map((s) => ({
        id: `${s.type}-${s.label}-${s.createdAt}`,
        type: s.type as DetectedSignalPayload["type"],
        label: s.label,
        confidence: 1,
        evidence: "",
        createdAt: new Date(s.createdAt).toISOString(),
      })),
    };

    return {
      state: statePayload,
      newSignals,
      recommendation,
      stageChanged: previousStage !== analysis.stage,
    };
  }

  private async playbookSnapshot(methodologyId: string) {
    const m = await this.playbooks.findById(methodologyId);
    return {
      name: m.name,
      stages: m.stages.map((s) => ({
        name: s.name,
        order: s.order,
        goal: s.goal,
        requiredFields: s.requiredFields,
        questions: s.questions.map((q) => ({ question: q.question, priority: q.priority })),
      })),
      objections: m.objections.map((o) => ({
        name: o.name,
        detectionExamples: o.detectionExamples,
        recommendedResponse: o.recommendedResponse,
        recommendedQuestions: o.recommendedQuestions,
      })),
      signals: m.signals.map((s) => ({
        type: s.type,
        name: s.name,
        detectionExamples: s.detectionExamples,
        recommendedAction: s.recommendedAction,
      })),
    };
  }
}
