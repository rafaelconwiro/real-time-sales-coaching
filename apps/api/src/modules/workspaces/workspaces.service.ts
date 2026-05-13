import { Injectable } from "@nestjs/common";
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
}
