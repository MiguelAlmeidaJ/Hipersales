import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@hipersales/database";
import { EnvService } from "../config/env.service.js";
import { parseDatabaseConnection } from "./database-config.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(env: EnvService) {
    const adapter = new PrismaMssql(parseDatabaseConnection(env.databaseUrl, env.databasePoolSize));
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
