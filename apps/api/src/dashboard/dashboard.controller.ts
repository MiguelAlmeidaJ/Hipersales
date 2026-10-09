import { Controller, Get, Query, Req } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("api")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("dashboard")
  summary(@Req() request: AuthenticatedRequest) {
    return this.dashboard.summary(request.user);
  }

  @Roles("admin")
  @Get("admin/summary")
  adminSummary(@Req() request: AuthenticatedRequest) {
    return this.dashboard.adminSummary(request.user);
  }

  @Roles("admin")
  @Get("admin/overview")
  overview(@Req() request: AuthenticatedRequest) {
    return this.dashboard.adminOverview(request.user);
  }

  @Roles("admin")
  @Get("admin/executive-dashboard")
  executive(
    @Req() request: AuthenticatedRequest,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
  ) {
    return this.dashboard.executive(request.user, {
      q,
      status,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }
}
