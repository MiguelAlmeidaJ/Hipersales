import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { ProposalsModule } from "./proposals/proposals.module.js";
import { OccurrencesModule } from "./occurrences/occurrences.module.js";
import { UsersModule } from "./users/users.module.js";
import { GoalsModule } from "./goals/goals.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { CsrfMiddleware } from "./common/middleware/csrf.middleware.js";
import { RolesGuard } from "./common/guards/roles.guard.js";
import { SessionGuard } from "./common/guards/session.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    AuthModule,
    CatalogModule,
    CustomersModule,
    ProposalsModule,
    OccurrencesModule,
    UsersModule,
    GoalsModule,
    DashboardModule,
    SettingsModule,
    DocumentsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes("*path");
  }
}
