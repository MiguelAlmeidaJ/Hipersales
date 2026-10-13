import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@hipersales/contracts";
import { Public } from "../common/decorators/public.decorator.js";
import { DatabaseRepository } from "../database/database.repository.js";

@Controller("api")
export class HealthController {
  constructor(private readonly database: DatabaseRepository) {}

  @Public()
  @Get("health")
  async health(): Promise<HealthResponse> {
    await this.database.db.prepare("SELECT 1").get();
    return { status: "ok", service: "hipersales-api" };
  }
}
