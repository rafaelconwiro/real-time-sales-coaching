import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CallSessionsService } from "./call-sessions.service";
import type { SessionChannel } from "@prisma/client";

interface CreateBody {
  workspaceId?: string;
  methodologyId?: string;
  title?: string;
  channel?: SessionChannel;
  script?: string;
  prospectName?: string;
  prospectCompany?: string;
}

@Controller("sessions")
export class CallSessionsController {
  constructor(private readonly sessions: CallSessionsService) {}

  @Post()
  create(@Body() body: CreateBody) {
    return this.sessions.create(body ?? {});
  }

  @Post(":id/end")
  end(@Param("id") id: string) {
    return this.sessions.end(id);
  }

  @Get(":id")
  byId(@Param("id") id: string) {
    return this.sessions.findById(id);
  }
}
