import { Body, Controller, Get, Header, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type ChangePasswordRequest,
  type LoginRequest,
  type LogoutResponse,
  type MobileSessionResponse,
  type SessionResponse,
} from "@hipersales/contracts";
import type { Request, Response } from "express";
import { Public } from "../common/decorators/public.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { getSessionToken } from "./session-token.js";

@Controller("api")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.login(input);
    response.cookie(this.auth.sessionCookieName, result.token, this.auth.cookieOptions);
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  @Post("mobile/login")
  async mobileLogin(
    @Body(new ZodValidationPipe(loginRequestSchema)) input: LoginRequest,
  ): Promise<MobileSessionResponse> {
    const result = await this.auth.login(input);
    return { user: result.user, session_token: result.token };
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LogoutResponse> {
    const token = getSessionToken(request, this.auth.sessionCookieName);
    await this.auth.logout(token);
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
