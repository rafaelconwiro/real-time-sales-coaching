import { Controller, Param, Post } from "@nestjs/common";
import { ScoringService } from "./scoring.service";

@Controller("sessions")
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Post(":id/finalize")
  finalize(@Param("id") id: string) {
    return this.scoring.finalize(id);
  }
}
