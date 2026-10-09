import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js";
import { EnvService } from "./config/env.service.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === "test" ? false : ["log", "error", "warn"],
  });
  const env = app.get(EnvService);
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;

  expressApp.set("trust proxy", env.trustProxy);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "5mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(env.port, env.host);
}

void bootstrap();
