import { Module } from "@nestjs/common";
import { CallSessionsService } from "./call-sessions.service";
import { CallSessionsController } from "./call-sessions.controller";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { PlaybooksModule } from "../playbooks/playbooks.module";

@Module({
  imports: [WorkspacesModule, PlaybooksModule],
  controllers: [CallSessionsController],
  providers: [CallSessionsService],
  exports: [CallSessionsService],
})
export class CallSessionsModule {}
