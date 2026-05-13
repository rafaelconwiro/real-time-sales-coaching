import { Module } from "@nestjs/common";
import { GeminiLiveService } from "./gemini-live.service";

@Module({
  providers: [GeminiLiveService],
  exports: [GeminiLiveService],
})
export class TranscriptionModule {}
