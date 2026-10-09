import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module.js";
import { CsrfMiddleware } from "./common/middleware/csrf.middleware.js";
import { RolesGuard } from "./common/guards/roles.guard.js";
import { SessionGuard } from "./common/guards/session.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { LegacyProxyMiddleware } from "./legacy/legacy-proxy.middleware.js";

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    LegacyProxyMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware, LegacyProxyMiddleware).forRoutes("*path");
  }
}
