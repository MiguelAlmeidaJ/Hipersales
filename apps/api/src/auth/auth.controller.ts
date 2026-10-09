import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type ChangePasswordRequest,
  type LoginRequest,
  type LogoutResponse,
  type SessionResponse,
} from "@hipersales/contracts";
import type { Request, Response } from "express";
import { Public } from "../common/decorators/public.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";

@Controller("api")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("login")
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): SessionResponse {
    const result = this.auth.login(input);
    response.cookie(this.auth.sessionCookieName, result.token, this.auth.cookieOptions);
    return { user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): LogoutResponse {
    const token = request.cookies?.[this.auth.sessionCookieName] as string | undefined;
    this.auth.logout(token);
    const { maxAge: _maxAge, ...clearOptions } = this.auth.cookieOptions;
    response.clearCookie(this.auth.sessionCookieName, clearOptions);
    return { ok: true };
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest): SessionResponse {
    return { user: request.user };
  }

  @HttpCode(200)
  @Post("me/password")
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) input: ChangePasswordRequest,
  ) {
    return this.auth.changePassword(request.user, request.sessionToken, input);
  }
}
