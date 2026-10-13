import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";
import { BootstrapAdminService } from "./bootstrap-admin.service.js";
import { PrismaService } from "./prisma.service.js";
import { SqlServerReadService } from "./sqlserver-read.service.js";

@Global()
@Module({
  providers: [EnvService, PrismaService, DatabaseService, BootstrapAdminService, SqlServerReadService],
  exports: [EnvService, DatabaseService, PrismaService, SqlServerReadService],
})
export class DatabaseModule {}
