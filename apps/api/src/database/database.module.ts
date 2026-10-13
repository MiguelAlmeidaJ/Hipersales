import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";
import { BootstrapAdminService } from "./bootstrap-admin.service.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [EnvService, PrismaService, DatabaseService, BootstrapAdminService],
  exports: [EnvService, DatabaseService, PrismaService],
})
export class DatabaseModule {}
