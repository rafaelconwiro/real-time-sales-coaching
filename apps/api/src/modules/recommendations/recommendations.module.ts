import { Module } from "@nestjs/common";
import { PlaybooksModule } from "../playbooks/playbooks.module";
import { ConversationStateService } from "./conversation-state.service";
import { RulesEngineService } from "./rules-engine.service";
import { LiveAnalysisService } from "./live-analysis.service";
import { RecommendationService } from "./recommendation.service";

@Module({
  imports: [PlaybooksModule],
  providers: [
    ConversationStateService,
    RulesEngineService,
    LiveAnalysisService,
    RecommendationService,
  ],
  exports: [RecommendationService, ConversationStateService],
})
export class RecommendationsModule {}
