import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@hipersales/contracts";
import { Public } from "../common/decorators/public.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { PrismaService } from "../database/prisma.service.js";

@Controller("api")
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get("health")
  async health(): Promise<HealthResponse> {
    await this.database.db.prepare("SELECT 1").get();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", service: "hipersales-api" };
  }
}
