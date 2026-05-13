import { Controller, Get } from "@nestjs/common";
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
}
