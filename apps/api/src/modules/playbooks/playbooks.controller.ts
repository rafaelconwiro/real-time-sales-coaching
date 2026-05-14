import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PlaybooksService } from "./playbooks.service";

@Controller("playbooks")
export class PlaybooksController {
  constructor(private readonly playbooks: PlaybooksService) {}

  @Get()
  list(@Query("workspaceId") workspaceId: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId required");
    return this.playbooks.list(workspaceId);
  }

  @Post()
  create(@Body() body: any) {
    if (!body?.workspaceId) throw new BadRequestException("workspaceId required");
    if (!body?.name) throw new BadRequestException("name required");
    return this.playbooks.create(body.workspaceId, body);
  }

  @Post("ingest")
  ingest(@Body() body: { workspaceId: string; rawContent: string }) {
    if (!body?.workspaceId) throw new BadRequestException("workspaceId required");
    if (!body?.rawContent) throw new BadRequestException("rawContent required");
    return this.playbooks.ingestFromText(body.workspaceId, body.rawContent);
  }

  @Get(":id")
  byId(@Param("id") id: string) {
    return this.playbooks.findById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.playbooks.update(id, body, body?.versionLabel);
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string) {
    return this.playbooks.duplicate(id);
  }

  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.playbooks.setStatus(id, "active");
  }

  @Post(":id/archive")
  archive(@Param("id") id: string) {
    return this.playbooks.setStatus(id, "archived");
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.playbooks.setStatus(id, "archived");
  }

  @Get(":id/versions")
  versions(@Param("id") id: string) {
    return this.playbooks.listVersions(id);
  }

  @Post(":id/versions/:version/restore")
  restore(@Param("id") id: string, @Param("version") version: string) {
    return this.playbooks.restoreVersion(id, Number(version));
  }
}
