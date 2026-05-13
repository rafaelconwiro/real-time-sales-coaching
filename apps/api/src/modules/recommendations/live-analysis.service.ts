import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { liveAnalysisSystemPrompt } from "@rtsc/prompts";
import { liveAnalysisResponseSchema, type LiveAnalysisResponse } from "@rtsc/shared";

interface PlaybookSnapshot {
  name: string;
  stages: {
    name: string;
    order: number;
    goal: string;
    requiredFields: string[];
    questions: { question: string; priority: string }[];
  }[];
  objections: {
    name: string;
    detectionExamples: string[];
    recommendedResponse: string;
    recommendedQuestions: string[];
  }[];
  signals: {
    type: string;
    name: string;
    detectionExamples: string[];
    recommendedAction: string;
  }[];
}

interface AnalyzeInput {
  currentStage: string;
  knownFields: Record<string, string | null>;
  recentSegments: { speaker: string; text: string }[];
  playbook: PlaybookSnapshot;
  script?: string | null;
  prospectName?: string | null;
  prospectCompany?: string | null;
}

@Injectable()
export class LiveAnalysisService {
  private readonly logger = new Logger(LiveAnalysisService.name);
  private readonly client?: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("google.apiKey");
    this.model = this.config.get<string>("google.textModel") ?? "gemini-flash-latest";
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn("GOOGLE_API_KEY missing — Gemini live analysis disabled, fallback to rules");
    }
  }

  isEnabled() {
    return !!this.client;
  }

  async analyze(input: AnalyzeInput): Promise<LiveAnalysisResponse | null> {
    if (!this.client) return null;
    const started = Date.now();
    try {
      const userPayload = {
        currentStage: input.currentStage,
        knownFields: input.knownFields,
        recentTranscript: input.recentSegments
          .map((s) => `${s.speaker}: ${s.text}`)
          .join("\n"),
        playbook: input.playbook,
        sellerScript: input.script ?? undefined,
        prospect: input.prospectName || input.prospectCompany
          ? { name: input.prospectName ?? undefined, company: input.prospectCompany ?? undefined }
          : undefined,
      };

      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userPayload) }],
          },
        ],
        config: {
          systemInstruction: liveAnalysisSystemPrompt,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = result.text ?? "";
      if (!text) return null;
      const parsed = JSON.parse(text);
      const validated = liveAnalysisResponseSchema.safeParse(parsed);
      if (!validated.success) {
        this.logger.warn(`Gemini response failed schema: ${validated.error.message}`);
        return null;
      }
      this.logger.debug(`Gemini live analysis ok in ${Date.now() - started}ms`);
      return validated.data;
    } catch (err) {
      this.logger.error(`Gemini live analysis error: ${(err as Error).message}`);
      return null;
    }
  }
}
