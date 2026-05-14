import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { PlaybooksService } from "../playbooks/playbooks.service";
import type { CallLanguage, CallTag, SessionChannel } from "@prisma/client";
import { Prisma } from "@prisma/client";

interface CreateSessionInput {
  workspaceId?: string;
  methodologyId?: string;
  prospectId?: string;
  title?: string;
  channel?: SessionChannel;
  language?: CallLanguage;
  script?: string;
  prospectName?: string;
  prospectCompany?: string;
}

interface ListSessionsInput {
  workspaceId: string;
  search?: string;
  tag?: CallTag;
  methodologyId?: string;
  stage?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CallSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly playbooks: PlaybooksService,
  ) {}

  async create(input: CreateSessionInput) {
    const workspace = input.workspaceId
      ? await this.prisma.workspace.findUnique({ where: { id: input.workspaceId } })
      : await this.workspaces.getOrCreateDefault();
    if (!workspace) throw new NotFoundException("Workspace not found");

    let methodologyId = input.methodologyId;
    if (!methodologyId) {
      const active = await this.playbooks.getActiveForWorkspace(workspace.id);
      methodologyId = active?.id;
    }

    return this.prisma.callSession.create({
      data: {
        workspaceId: workspace.id,
        methodologyId,
        prospectId: input.prospectId ?? null,
        title: input.title ?? "Sesion demo",
        channel: input.channel ?? "simulation",
        language: input.language ?? "es",
        status: "live",
        startedAt: new Date(),
        script: input.script ?? null,
        prospectName: input.prospectName ?? null,
        prospectCompany: input.prospectCompany ?? null,
      },
    });
  }

  async end(sessionId: string) {
    return this.prisma.callSession.update({
      where: { id: sessionId },
      data: { status: "ended", endedAt: new Date() },
    });
  }

  async setTag(sessionId: string, tag: CallTag | null) {
    return this.prisma.callSession.update({
      where: { id: sessionId },
      data: { tag },
    });
  }

  async findById(sessionId: string) {
    const s = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: {
        methodology: {
          include: {
            stages: { include: { questions: true }, orderBy: { order: "asc" } },
            objections: true,
            signals: true,
          },
        },
        prospect: true,
        segments: { orderBy: { createdAt: "asc" } },
        signals: { orderBy: { createdAt: "asc" } },
        recommendations: { orderBy: { createdAt: "asc" } },
        score: true,
      },
    });
    if (!s) throw new NotFoundException("Session not found");
    return s;
  }

  async list(input: ListSessionsInput) {
    const where: Prisma.CallSessionWhereInput = { workspaceId: input.workspaceId };
    if (input.tag) where.tag = input.tag;
    if (input.methodologyId) where.methodologyId = input.methodologyId;
    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: "insensitive" } },
        { prospectName: { contains: input.search, mode: "insensitive" } },
        { prospectCompany: { contains: input.search, mode: "insensitive" } },
        {
          segments: {
            some: { text: { contains: input.search, mode: "insensitive" } },
          },
        },
      ];
    }
    const items = await this.prisma.callSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
      include: {
        methodology: { select: { id: true, name: true } },
        score: { select: { overallScore: true } },
        _count: { select: { segments: true, signals: true, recommendations: true } },
      },
    });
    return items;
  }

  async comparative(workspaceId: string, take: number) {
    return this.prisma.callSession.findMany({
      where: { workspaceId, score: { isNot: null } },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        score: {
          select: {
            overallScore: true,
            discoveryScore: true,
            qualificationScore: true,
            objectionScore: true,
            closingScore: true,
            methodologyAdherence: true,
          },
        },
        methodology: { select: { name: true } },
      },
    });
  }

  async highlights(sessionId: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: {
        signals: { orderBy: { createdAt: "asc" }, include: { transcriptSegment: true } },
        recommendations: { orderBy: { createdAt: "asc" } },
        segments: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (!session) throw new NotFoundException("Session not found");
    const startAt = session.segments[0]?.createdAt ?? session.startedAt ?? session.createdAt;
    const startMs = startAt.getTime();
    const out: Array<{
      kind: "signal" | "recommendation";
      type: string;
      label: string;
      offsetMs: number;
      evidence?: string;
      segmentText?: string;
    }> = [];
    for (const sig of session.signals) {
      if (sig.type === "buying_signal" || sig.type === "risk_signal" || sig.type === "objection") {
        out.push({
          kind: "signal",
          type: sig.type,
          label: sig.label,
          offsetMs: sig.createdAt.getTime() - startMs,
          evidence: sig.evidence,
          segmentText: sig.transcriptSegment?.text,
        });
      }
    }
    for (const rec of session.recommendations) {
      if (rec.priority === "high") {
        out.push({
          kind: "recommendation",
          type: rec.type,
          label: rec.title,
          offsetMs: rec.createdAt.getTime() - startMs,
          evidence: rec.suggestedPhrase ?? rec.message,
        });
      }
    }
    return out.sort((a, b) => a.offsetMs - b.offsetMs);
  }

  async transcriptText(sessionId: string) {
    const segments = await this.prisma.transcriptSegment.findMany({
      where: { callSessionId: sessionId, isFinal: true },
      orderBy: { createdAt: "asc" },
    });
    return segments.map((s) => `[${s.createdAt.toISOString()}] ${s.speaker}: ${s.text}`).join("\n");
  }

  async exportJson(sessionId: string) {
    return this.prisma.callSession.findUnique({
      where: { id: sessionId },
      include: {
        methodology: {
          include: {
            stages: { include: { questions: true }, orderBy: { order: "asc" } },
            objections: true,
            signals: true,
          },
        },
        prospect: true,
        segments: { orderBy: { createdAt: "asc" } },
        signals: { orderBy: { createdAt: "asc" } },
        recommendations: { orderBy: { createdAt: "asc" } },
        score: true,
      },
    });
  }
}
