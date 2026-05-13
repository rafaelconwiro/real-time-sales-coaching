import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class PlaybooksService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.salesMethodology.findMany({
      where: { workspaceId },
      include: { stages: { include: { questions: true } }, objections: true, signals: true },
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
    const m = await this.prisma.salesMethodology.findFirst({
      where: { workspaceId, status: "active" },
      include: {
        stages: { include: { questions: true }, orderBy: { order: "asc" } },
        objections: true,
        signals: true,
      },
    });
    return m;
  }
}
