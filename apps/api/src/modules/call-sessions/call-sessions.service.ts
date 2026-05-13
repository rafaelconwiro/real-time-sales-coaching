import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { PlaybooksService } from "../playbooks/playbooks.service";
import type { SessionChannel } from "@prisma/client";

interface CreateSessionInput {
  workspaceId?: string;
  methodologyId?: string;
  title?: string;
  channel?: SessionChannel;
  script?: string;
  prospectName?: string;
  prospectCompany?: string;
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
        title: input.title ?? "Sesion demo",
        channel: input.channel ?? "simulation",
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
        segments: { orderBy: { createdAt: "asc" } },
        signals: { orderBy: { createdAt: "asc" } },
        recommendations: { orderBy: { createdAt: "asc" } },
        score: true,
      },
    });
    if (!s) throw new NotFoundException("Session not found");
    return s;
  }
}
