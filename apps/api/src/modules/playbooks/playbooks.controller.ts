import { Controller, Get, Param, Query } from "@nestjs/common";
import { PlaybooksService } from "./playbooks.service";

@Controller("playbooks")
export class PlaybooksController {
  constructor(private readonly playbooks: PlaybooksService) {}

  @Get()
  list(@Query("workspaceId") workspaceId: string) {
    return this.playbooks.list(workspaceId);
  }

  @Get(":id")
  byId(@Param("id") id: string) {
    return this.playbooks.findById(id);
  }
}
