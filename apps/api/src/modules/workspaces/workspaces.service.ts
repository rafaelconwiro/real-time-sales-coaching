import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: "asc" },
      include: { users: true },
    });
  }

  async getOrCreateDefault() {
    const existing = await this.prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return this.prisma.workspace.create({ data: { name: "Demo Workspace" } });
  }

  async getPrecall(workspaceId: string) {
    const w = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { precallConfig: true },
    });
    if (!w) throw new NotFoundException("Workspace not found");
    return (w.precallConfig as Prisma.JsonValue) ?? null;
  }

  async setPrecall(workspaceId: string, config: Prisma.InputJsonValue) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { precallConfig: config },
      select: { precallConfig: true },
    });
  }
}
