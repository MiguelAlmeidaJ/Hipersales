import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";
import { BootstrapAdminService } from "./bootstrap-admin.service.js";
import { PrismaService } from "./prisma.service.js";
import { SqlServerReadService } from "./sqlserver-read.service.js";
import { SqlServerWriteService } from "./sqlserver-write.service.js";

@Global()
@Module({
  providers: [EnvService, PrismaService, DatabaseService, BootstrapAdminService, SqlServerReadService, SqlServerWriteService],
  exports: [EnvService, DatabaseService, PrismaService, SqlServerReadService, SqlServerWriteService],
})
export class DatabaseModule {}
