import type { Request } from "express";

const BEARER_PREFIX = "Bearer ";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export function getSessionToken(request: Request, cookieName: string): string | undefined {
  const authorization = request.get("authorization");
  if (authorization?.startsWith(BEARER_PREFIX)) {
    const bearerToken = authorization.slice(BEARER_PREFIX.length).trim();
    if (SESSION_TOKEN_PATTERN.test(bearerToken)) return bearerToken;
  }

  const cookieToken = request.cookies?.[cookieName] as unknown;
  return typeof cookieToken === "string" && SESSION_TOKEN_PATTERN.test(cookieToken)
    ? cookieToken
    : undefined;
}
