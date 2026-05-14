import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ProspectsService } from "./prospects.service";

@Controller("prospects")
export class ProspectsController {
  constructor(private readonly prospects: ProspectsService) {}

  @Get()
  list(@Query("workspaceId") workspaceId: string, @Query("search") search?: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId required");
    return this.prospects.list(workspaceId, search?.trim() || undefined);
  }

  @Post()
  create(@Body() body: { workspaceId: string; name: string; company?: string; notes?: string }) {
    if (!body?.workspaceId || !body?.name) throw new BadRequestException("workspaceId + name required");
    return this.prospects.upsert(body.workspaceId, body.name, body.company, body.notes);
  }

  @Get(":id")
  byId(@Param("id") id: string) {
    return this.prospects.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; company?: string | null; notes?: string | null },
  ) {
    return this.prospects.update(id, body);
  }
}
