import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PlaybooksService } from "../playbooks/playbooks.service";
import { postCallSummarySystemPrompt } from "@rtsc/prompts";
import { postCallSummarySchema, type PostCallSummary } from "@rtsc/shared";

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private readonly client?: GoogleGenAI;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly playbooks: PlaybooksService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>("google.apiKey");
    this.model = this.config.get<string>("google.textModel") ?? "gemini-flash-latest";
    if (apiKey) this.client = new GoogleGenAI({ apiKey });
  }

  async finalize(sessionId: string): Promise<PostCallSummary | null> {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: {
        segments: { orderBy: { createdAt: "asc" } },
        methodology: {
          include: { stages: { include: { questions: true } }, objections: true, signals: true },
        },
      },
    });
    if (!session) return null;

    const transcript = session.segments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n");

    const playbook = session.methodology
      ? {
          name: session.methodology.name,
          stages: session.methodology.stages.map((s) => ({
            name: s.name,
            goal: s.goal,
            requiredFields: s.requiredFields,
          })),
          objections: session.methodology.objections.map((o) => ({
            name: o.name,
            recommendedResponse: o.recommendedResponse,
          })),
        }
      : null;

    let summary: PostCallSummary | null = null;
    if (this.client) {
      try {
        const result = await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({ transcript, playbook }),
                },
              ],
            },
          ],
          config: {
            systemInstruction: postCallSummarySystemPrompt,
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
        const text = result.text ?? "";
        const parsed = JSON.parse(text);
        const validated = postCallSummarySchema.safeParse(parsed);
        if (validated.success) summary = validated.data;
        else this.logger.warn(`Post-call schema invalid: ${validated.error.message}`);
      } catch (err) {
        this.logger.error(`Gemini post-call error: ${(err as Error).message}`);
      }
    }

    if (!summary) {
      summary = this.fallbackSummary(transcript);
    }

    await this.prisma.callScore.upsert({
      where: { callSessionId: sessionId },
      create: {
        callSessionId: sessionId,
        overallScore: summary.score.overallScore,
        discoveryScore: summary.score.discoveryScore,
        qualificationScore: summary.score.qualificationScore,
        objectionScore: summary.score.objectionScore,
        closingScore: summary.score.closingScore,
        methodologyAdherence: summary.score.methodologyAdherence,
        missingFields: summary.missingFields,
        strengths: summary.score.strengths,
        improvements: summary.score.improvements,
        executiveSummary: summary.executiveSummary,
        suggestedEmail: summary.suggestedEmail,
      },
      update: {
        overallScore: summary.score.overallScore,
        discoveryScore: summary.score.discoveryScore,
        qualificationScore: summary.score.qualificationScore,
        objectionScore: summary.score.objectionScore,
        closingScore: summary.score.closingScore,
        methodologyAdherence: summary.score.methodologyAdherence,
        missingFields: summary.missingFields,
        strengths: summary.score.strengths,
        improvements: summary.score.improvements,
        executiveSummary: summary.executiveSummary,
        suggestedEmail: summary.suggestedEmail,
      },
    });

    return summary;
  }

  private fallbackSummary(transcript: string): PostCallSummary {
    const length = transcript.length;
    const base = Math.min(80, Math.max(30, Math.floor(length / 30)));
    return {
      executiveSummary:
        length > 0
          ? "Resumen automatico no disponible (Gemini no configurado). Revisa la transcripcion."
          : "Sin transcripcion suficiente.",
      painPoints: [],
      objections: [],
      buyingSignals: [],
      risks: [],
      missingFields: [],
      nextSteps: [],
      suggestedEmail: "",
      score: {
        overallScore: base,
        discoveryScore: base,
        qualificationScore: base,
        objectionScore: base,
        closingScore: base,
        methodologyAdherence: base,
        strengths: [],
        improvements: ["Configurar GOOGLE_API_KEY para resumen real"],
      },
    };
  }
}
