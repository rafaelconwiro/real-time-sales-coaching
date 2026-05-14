import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { CallSessionsService } from "./call-sessions.service";
import type { CallLanguage, CallTag, SessionChannel } from "@prisma/client";

interface CreateBody {
  workspaceId?: string;
  methodologyId?: string;
  prospectId?: string;
  title?: string;
  channel?: SessionChannel;
  language?: CallLanguage;
  script?: string;
  prospectName?: string;
  prospectCompany?: string;
}

interface TagBody {
  tag: CallTag | null;
}

const VALID_TAGS = new Set(["won", "lost", "follow_up"]);

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

  @Patch(":id/tag")
  setTag(@Param("id") id: string, @Body() body: TagBody) {
    if (body.tag !== null && !VALID_TAGS.has(body.tag as string)) {
      throw new BadRequestException("Invalid tag");
    }
    return this.sessions.setTag(id, body.tag);
  }

  @Get()
  list(
    @Query("workspaceId") workspaceId: string,
    @Query("search") search?: string,
    @Query("tag") tag?: CallTag,
    @Query("methodologyId") methodologyId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    if (!workspaceId) throw new BadRequestException("workspaceId required");
    return this.sessions.list({
      workspaceId,
      search: search?.trim() || undefined,
      tag,
      methodologyId,
      limit: limit ? Math.min(200, Number(limit)) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("comparative")
  comparative(@Query("workspaceId") workspaceId: string, @Query("take") take?: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId required");
    return this.sessions.comparative(workspaceId, take ? Math.min(50, Number(take)) : 10);
  }

  @Get(":id")
  byId(@Param("id") id: string) {
    return this.sessions.findById(id);
  }

  @Get(":id/highlights")
  highlights(@Param("id") id: string) {
    return this.sessions.highlights(id);
  }

  @Get(":id/transcript.txt")
  @Header("Content-Type", "text/plain; charset=utf-8")
  async transcript(@Param("id") id: string, @Res({ passthrough: true }) res: any) {
    const body = await this.sessions.transcriptText(id);
    res.setHeader("Content-Disposition", `attachment; filename="transcript-${id}.txt"`);
    return body;
  }

  @Get(":id/export.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  async exportJson(@Param("id") id: string, @Res({ passthrough: true }) res: any) {
    const data = await this.sessions.exportJson(id);
    res.setHeader("Content-Disposition", `attachment; filename="session-${id}.json"`);
    return data;
  }
}
