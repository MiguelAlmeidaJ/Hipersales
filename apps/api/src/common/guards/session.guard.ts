import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../http/authenticated-request.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { AuthService } from "../../auth/auth.service.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.auth.sessionCookieName] as string | undefined;
    if (!token) throw new UnauthorizedException("Sessao expirada. Faca login novamente.");

    const user = this.auth.findSessionUser(token);
    if (!user) throw new UnauthorizedException("Sessao expirada. Faca login novamente.");
    request.user = user;
    request.sessionToken = token;
    return true;
  }
}
