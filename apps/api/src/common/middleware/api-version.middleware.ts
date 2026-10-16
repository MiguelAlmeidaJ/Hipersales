import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { API_VERSION } from "../api-version.js";

@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    if (request.originalUrl === `/api/${API_VERSION}` || request.originalUrl.startsWith(`/api/${API_VERSION}/`)) {
      response.setHeader("X-API-Version", API_VERSION);
    }
    next();
  }
}
