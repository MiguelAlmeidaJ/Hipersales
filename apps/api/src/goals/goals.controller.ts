import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import { saveGoalsRequestSchema, type SaveGoalsRequest } from "@hipersales/contracts";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { GoalsService } from "./goals.service.js";

@Controller("api")
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get("goals/my")
  mine(@Req() request: AuthenticatedRequest, @Query("year") year?: string, @Query("month") month?: string) {
    return this.goals.mine(request.user, year, month);
  }

  @Roles("admin")
  @Get("admin/goals")
  admin(@Req() request: AuthenticatedRequest, @Query("year") year?: string, @Query("month") month?: string) {
    return this.goals.admin(request.user, year, month);
  }

  @Roles("admin")
  @HttpCode(200)
  @Post("admin/goals")
  save(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(saveGoalsRequestSchema)) input: SaveGoalsRequest,
  ) {
    return this.goals.save(request.user, input);
  }
}
