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
  private readonly migrateAssignments = process.env.HIPERSALES_NEST_ASSIGNMENTS === "true";
  private readonly migrateCnpjLookup = process.env.HIPERSALES_NEST_CNPJ_LOOKUP === "true";
  private readonly migrateCustomerWrites = process.env.HIPERSALES_NEST_CUSTOMER_WRITES === "true";

  constructor(env: EnvService) {
    this.target = new URL(env.legacyApiOrigin);
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const path = request.originalUrl.split("?", 1)[0] ?? request.path;
    if ((!path.startsWith("/api/") && !path.startsWith("/assets/")) || NEST_ROUTES.has(path) || (request.method === "GET" && ["/api/companies", "/api/products", "/api/customers", "/api/admin/customers", "/api/admin/companies", "/api/admin/products", "/api/admin/products/export"].includes(path)) || (request.method === "POST" && ["/api/admin/companies", "/api/admin/products", "/api/admin/products/import"].includes(path)) || (request.method === "PATCH" && /^\/api\/admin\/(companies|products)\/\d+$/.test(path)) || (request.method === "DELETE" && /^\/api\/admin\/products\/\d+$/.test(path))) return next();

    if (this.migrateAssignments && (
      (request.method === "GET" && /^\/api\/admin\/users\/\d+\/(customers|companies)$/.test(path)) ||
      (request.method === "PATCH" && ["/api/admin/customer-assignments", "/api/admin/company-assignments"].includes(path))
    )) return next();

    if (this.migrateCnpjLookup && request.method === "GET" && path === "/api/integrations/cnpj") return next();

    // Gradual rollout: legacy enrichment and external CNPJ lookup still need parity validation.
    if (this.migrateCustomerWrites && (
      (request.method === "POST" && path === "/api/admin/customers") ||
      (["PATCH", "DELETE"].includes(request.method) && /^\/api\/admin\/customers\/\d+$/.test(path))
    )) return next();

    // Preserve non-JSON payloads (such as multipart uploads) instead of serializing them as JSON.
    const contentType = request.get("content-type") ?? "";
    const serializedBody = request.body !== undefined && (contentType.includes("application/json") || contentType.includes("application/x-www-form-urlencoded"));
    const body = serializedBody ? Buffer.from(contentType.includes("application/json") ? JSON.stringify(request.body) : new URLSearchParams(request.body as Record<string, string>).toString()) : undefined;
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
    else if (request.readableEnded || request.complete) upstream.end();
    else request.pipe(upstream);
  }
}
