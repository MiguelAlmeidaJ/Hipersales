import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@hipersales/contracts";
import { Public } from "../common/decorators/public.decorator.js";
import { DatabaseService } from "../database/database.service.js";

@Controller("api")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get("health")
  health(): HealthResponse {
    this.database.db.prepare("SELECT 1").get();
    return { status: "ok", service: "hipersales-api" };
  }
}
