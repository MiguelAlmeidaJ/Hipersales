import { Global, Module } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";

@Global()
@Module({
  providers: [EnvService, DatabaseService],
  exports: [EnvService, DatabaseService],
})
export class DatabaseModule {}
