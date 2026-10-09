import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { EnvService } from "../config/env.service.js";

const NEST_ROUTES = new Set([
  "/api/health",
  "/api/login",
  "/api/logout",
  "/api/me",
  "/api/me/password",
]);

@Injectable()
export class LegacyProxyMiddleware implements NestMiddleware {
  private readonly target: URL;

  constructor(env: EnvService) {
    this.target = new URL(env.legacyApiOrigin);
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const path = request.originalUrl.split("?", 1)[0] ?? request.path;
    if (!path.startsWith("/api/") || NEST_ROUTES.has(path)) return next();

    const body = request.body === undefined ? undefined : Buffer.from(JSON.stringify(request.body));
    const headers = { ...request.headers };
    for (const header of [
      "connection",
      "content-length",
      "content-encoding",
      "host",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
    ]) {
      delete headers[header];
    }
    if (body) headers["content-length"] = String(body.length);
    headers["x-forwarded-host"] = request.get("host") ?? "";
    headers["x-forwarded-proto"] = request.protocol;

    const transport = this.target.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = transport(
      new URL(request.originalUrl, this.target),
      { method: request.method, headers, timeout: 30_000 },
      (upstreamResponse) => {
        response.status(upstreamResponse.statusCode ?? 502);
        for (const [name, value] of Object.entries(upstreamResponse.headers)) {
          if (value !== undefined && !["connection", "keep-alive", "transfer-encoding"].includes(name)) {
            response.setHeader(name, value);
          }
        }
        upstreamResponse.pipe(response);
      },
    );

    upstream.on("timeout", () => upstream.destroy(new Error("Legacy API timeout")));
    upstream.on("error", () => {
      if (!response.headersSent) {
        response.status(502).json({ error: "Servico legado temporariamente indisponivel." });
      } else {
        response.end();
      }
    });
    request.on("aborted", () => upstream.destroy());
    if (body) upstream.end(body);
    else upstream.end();
  }
}
