import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";
import { BootstrapAdminService } from "./bootstrap-admin.service.js";

@Global()
@Module({
  providers: [EnvService, DatabaseService, BootstrapAdminService],
  exports: [EnvService, DatabaseService],
})
export class DatabaseModule {}
