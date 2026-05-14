import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthController } from "./common/health.controller";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { PlaybooksModule } from "./modules/playbooks/playbooks.module";
import { CallSessionsModule } from "./modules/call-sessions/call-sessions.module";
import { ProspectsModule } from "./modules/prospects/prospects.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { ScoringModule } from "./modules/scoring/scoring.module";
import { TranscriptionModule } from "./modules/transcription/transcription.module";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    WorkspacesModule,
    PlaybooksModule,
    CallSessionsModule,
    ProspectsModule,
    RecommendationsModule,
    ScoringModule,
    TranscriptionModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
