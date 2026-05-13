import { Module } from "@nestjs/common";
import { PlaybooksModule } from "../playbooks/playbooks.module";
import { ScoringService } from "./scoring.service";
import { ScoringController } from "./scoring.controller";

@Module({
  imports: [PlaybooksModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
