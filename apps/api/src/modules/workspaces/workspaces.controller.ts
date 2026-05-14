import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list() {
    return this.workspaces.list();
  }

  @Get("default")
  default() {
    return this.workspaces.getOrCreateDefault();
  }

  @Get(":id/precall")
  async getPrecall(@Param("id") id: string) {
    const config = await this.workspaces.getPrecall(id);
    return { config };
  }

  @Put(":id/precall")
  setPrecall(@Param("id") id: string, @Body() body: { config: unknown }) {
    return this.workspaces.setPrecall(id, (body.config ?? {}) as Prisma.InputJsonValue);
  }
}
