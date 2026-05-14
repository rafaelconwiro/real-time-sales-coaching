import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string, search?: string) {
    return this.prisma.prospect.findMany({
      where: {
        workspaceId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async findById(id: string) {
    const p = await this.prisma.prospect.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          include: { score: { select: { overallScore: true } } },
          take: 20,
        },
      },
    });
    if (!p) throw new NotFoundException("Prospect not found");
    return p;
  }

  upsert(workspaceId: string, name: string, company?: string, notes?: string) {
    return this.prisma.prospect.create({
      data: { workspaceId, name, company: company ?? null, notes: notes ?? null },
    });
  }

  update(id: string, data: { name?: string; company?: string | null; notes?: string | null }) {
    return this.prisma.prospect.update({ where: { id }, data });
  }
}
