import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = process.env.HYPERSALES_WHATSAPP_INTERNAL_TOKEN?.trim() ?? "";
    const provided = request.get("x-hipersales-token")?.trim() || String(request.query.token ?? "").trim();
    const left = Buffer.from(expected);
    const right = Buffer.from(provided);

    if (!expected || !provided || left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ForbiddenException("Token interno invalido.");
    }
    return true;
  }
}
