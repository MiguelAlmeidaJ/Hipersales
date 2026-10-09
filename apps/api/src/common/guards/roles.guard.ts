import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@hipersales/contracts";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../http/authenticated-request.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user && roles.includes(request.user.role)) return true;
    throw new ForbiddenException("Acesso permitido apenas para administradores.");
  }
}
