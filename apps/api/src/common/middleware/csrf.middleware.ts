import { ForbiddenException, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { EnvService } from "../../config/env.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly env: EnvService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) return next();

    const fetchSite = request.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      throw new ForbiddenException("Origem da requisicao nao permitida.");
    }

    const origin = request.get("origin");
    if (!origin) return next();

    const allowed = origin === this.env.publicUrl.origin || this.env.allowedOrigins.has(origin);

    if (!allowed) throw new ForbiddenException("Origem da requisicao nao permitida.");
    next();
  }
}
