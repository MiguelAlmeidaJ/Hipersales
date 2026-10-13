import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseRepository } from "./database.repository.js";
import { BootstrapAdminService } from "./bootstrap-admin.service.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [EnvService, PrismaService, DatabaseRepository, BootstrapAdminService],
  exports: [EnvService, DatabaseRepository],
})
export class DatabaseModule {}
