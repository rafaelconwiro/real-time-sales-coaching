import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { playbookStructuringSystemPrompt } from "@rtsc/prompts";

interface StageInput {
  name: string;
  order: number;
  goal: string;
  exitCriteria?: string | null;
  requiredFields?: string[];
  questions?: { question: string; purpose?: string | null; priority?: "low" | "medium" | "high" }[];
}
interface ObjectionInput {
  name: string;
  detectionExamples?: string[];
  recommendedResponse: string;
  recommendedQuestions?: string[];
}
interface SignalInput {
  type: "buying_signal" | "risk_signal" | "missing_info" | "competitor" | "urgency" | "budget" | "objection";
  name: string;
  detectionExamples?: string[];
  recommendedAction: string;
}
interface MethodologyInput {
  name: string;
  description?: string | null;
  rawContent?: string | null;
  status?: "draft" | "active" | "archived";
  stages?: StageInput[];
  objections?: ObjectionInput[];
  signals?: SignalInput[];
}

@Injectable()
export class PlaybooksService {
  private readonly logger = new Logger(PlaybooksService.name);
  private readonly client?: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("google.apiKey");
    this.model = this.config.get<string>("google.textModel") ?? "gemini-flash-latest";
    if (apiKey) this.client = new GoogleGenAI({ apiKey });
  }

  list(workspaceId: string) {
    return this.prisma.salesMethodology.findMany({
      where: { workspaceId },
      include: { stages: { include: { questions: true }, orderBy: { order: "asc" } }, objections: true, signals: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const m = await this.prisma.salesMethodology.findUnique({
      where: { id },
      include: {
        stages: { include: { questions: true }, orderBy: { order: "asc" } },
        objections: true,
        signals: true,
      },
    });
    if (!m) throw new NotFoundException("Methodology not found");
    return m;
  }

  async getActiveForWorkspace(workspaceId: string) {
    return this.prisma.salesMethodology.findFirst({
      where: { workspaceId, status: "active" },
      include: {
        stages: { include: { questions: true }, orderBy: { order: "asc" } },
        objections: true,
        signals: true,
      },
    });
  }

  async create(workspaceId: string, input: MethodologyInput) {
    return this.prisma.salesMethodology.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        rawContent: input.rawContent ?? null,
        status: input.status ?? "draft",
        stages: this.buildStageCreate(input.stages),
        objections: this.buildObjectionCreate(input.objections),
        signals: this.buildSignalCreate(input.signals),
      },
      include: { stages: { include: { questions: true } }, objections: true, signals: true },
    });
  }

  async update(id: string, input: Partial<MethodologyInput>, versionLabel?: string) {
    const existing = await this.findById(id);
    await this.snapshotVersion(existing.id, existing.currentVersion, versionLabel);

    return this.prisma.$transaction(async (tx) => {
      if (input.stages) {
        await tx.playbookQuestion.deleteMany({ where: { stage: { methodologyId: id } } });
        await tx.playbookStage.deleteMany({ where: { methodologyId: id } });
      }
      if (input.objections) {
        await tx.playbookObjection.deleteMany({ where: { methodologyId: id } });
      }
      if (input.signals) {
        await tx.playbookSignal.deleteMany({ where: { methodologyId: id } });
      }
      const data: Prisma.SalesMethodologyUpdateInput = {
        currentVersion: existing.currentVersion + 1,
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.rawContent !== undefined) data.rawContent = input.rawContent;
      if (input.status !== undefined) data.status = input.status;
      if (input.stages) data.stages = this.buildStageCreate(input.stages);
      if (input.objections) data.objections = this.buildObjectionCreate(input.objections);
      if (input.signals) data.signals = this.buildSignalCreate(input.signals);
      return tx.salesMethodology.update({
        where: { id },
        data,
        include: { stages: { include: { questions: true } }, objections: true, signals: true },
      });
    });
  }

  async duplicate(id: string) {
    const src = await this.findById(id);
    return this.create(src.workspaceId, {
      name: `${src.name} (copia)`,
      description: src.description,
      rawContent: src.rawContent,
      status: "draft",
      stages: src.stages.map((s) => ({
        name: s.name,
        order: s.order,
        goal: s.goal,
        exitCriteria: s.exitCriteria,
        requiredFields: s.requiredFields,
        questions: s.questions.map((q) => ({
          question: q.question,
          purpose: q.purpose,
          priority: q.priority,
        })),
      })),
      objections: src.objections.map((o) => ({
        name: o.name,
        detectionExamples: o.detectionExamples,
        recommendedResponse: o.recommendedResponse,
        recommendedQuestions: o.recommendedQuestions,
      })),
      signals: src.signals.map((s) => ({
        type: s.type,
        name: s.name,
        detectionExamples: s.detectionExamples,
        recommendedAction: s.recommendedAction,
      })),
    });
  }

  async setStatus(id: string, status: "draft" | "active" | "archived") {
    return this.prisma.salesMethodology.update({ where: { id }, data: { status } });
  }

  async listVersions(id: string) {
    return this.prisma.methodologyVersion.findMany({
      where: { methodologyId: id },
      orderBy: { version: "desc" },
    });
  }

  async restoreVersion(id: string, version: number) {
    const v = await this.prisma.methodologyVersion.findUnique({
      where: { methodologyId_version: { methodologyId: id, version } },
    });
    if (!v) throw new NotFoundException("Version not found");
    const snapshot = v.snapshot as unknown as MethodologyInput;
    return this.update(id, snapshot, `restore_from_v${version}`);
  }

  async ingestFromText(workspaceId: string, rawContent: string) {
    if (!this.client) throw new BadRequestException("Gemini no configurado (GOOGLE_API_KEY)");
    if (!rawContent.trim()) throw new BadRequestException("rawContent vacio");

    const result = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: rawContent }] }],
      config: {
        systemInstruction: playbookStructuringSystemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const text = result.text ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new BadRequestException(`Gemini devolvio JSON invalido: ${(err as Error).message}`);
    }
    const stages = (parsed.stages ?? []).map((s: any, idx: number) => ({
      name: String(s.name ?? `stage_${idx}`).toLowerCase(),
      order: typeof s.order === "number" ? s.order : idx,
      goal: String(s.goal ?? ""),
      exitCriteria: s.exitCriteria ?? null,
      requiredFields: Array.isArray(s.requiredFields) ? s.requiredFields : [],
      questions: Array.isArray(s.questions)
        ? s.questions.map((q: any) => ({
            question: String(q.question ?? ""),
            purpose: q.purpose ?? null,
            priority: q.priority ?? "medium",
          }))
        : [],
    }));
    const objections = (parsed.objections ?? []).map((o: any) => ({
      name: String(o.name ?? ""),
      detectionExamples: Array.isArray(o.detectionExamples) ? o.detectionExamples : [],
      recommendedResponse: String(o.recommendedResponse ?? ""),
      recommendedQuestions: Array.isArray(o.recommendedQuestions) ? o.recommendedQuestions : [],
    }));
    const signals = (parsed.signals ?? []).map((s: any) => ({
      type: s.type ?? "missing_info",
      name: String(s.name ?? ""),
      detectionExamples: Array.isArray(s.detectionExamples) ? s.detectionExamples : [],
      recommendedAction: String(s.recommendedAction ?? ""),
    }));

    return this.create(workspaceId, {
      name: parsed.name ?? "Metodologia ingerida",
      description: parsed.description ?? null,
      rawContent,
      status: "draft",
      stages,
      objections,
      signals,
    });
  }

  private async snapshotVersion(id: string, version: number, label?: string) {
    const m = await this.findById(id);
    await this.prisma.methodologyVersion.upsert({
      where: { methodologyId_version: { methodologyId: id, version } },
      create: {
        methodologyId: id,
        version,
        label: label ?? null,
        snapshot: {
          name: m.name,
          description: m.description,
          rawContent: m.rawContent,
          status: m.status,
          stages: m.stages.map((s) => ({
            name: s.name,
            order: s.order,
            goal: s.goal,
            exitCriteria: s.exitCriteria,
            requiredFields: s.requiredFields,
            questions: s.questions.map((q) => ({
              question: q.question,
              purpose: q.purpose,
              priority: q.priority,
            })),
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
        } as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  private buildStageCreate(stages?: StageInput[]) {
    if (!stages) return undefined;
    return {
      create: stages.map((s) => ({
        name: s.name,
        order: s.order,
        goal: s.goal,
        exitCriteria: s.exitCriteria ?? null,
        requiredFields: s.requiredFields ?? [],
        questions: s.questions
          ? { create: s.questions.map((q) => ({ question: q.question, purpose: q.purpose ?? null, priority: q.priority ?? "medium" })) }
          : undefined,
      })),
    };
  }

  private buildObjectionCreate(objections?: ObjectionInput[]) {
    if (!objections) return undefined;
    return {
      create: objections.map((o) => ({
        name: o.name,
        detectionExamples: o.detectionExamples ?? [],
        recommendedResponse: o.recommendedResponse,
        recommendedQuestions: o.recommendedQuestions ?? [],
      })),
    };
  }

  private buildSignalCreate(signals?: SignalInput[]) {
    if (!signals) return undefined;
    return {
      create: signals.map((s) => ({
        type: s.type,
        name: s.name,
        detectionExamples: s.detectionExamples ?? [],
        recommendedAction: s.recommendedAction,
      })),
    };
  }
}
