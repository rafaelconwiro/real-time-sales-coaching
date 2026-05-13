import { Module } from "@nestjs/common";
import { CallSessionsModule } from "../call-sessions/call-sessions.module";
import { RecommendationsModule } from "../recommendations/recommendations.module";
import { ScoringModule } from "../scoring/scoring.module";
import { TranscriptionModule } from "../transcription/transcription.module";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [CallSessionsModule, RecommendationsModule, ScoringModule, TranscriptionModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
