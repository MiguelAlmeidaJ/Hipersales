import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { getSessionToken } from "../src/auth/session-token.js";

const token = "a".repeat(43);

function request(headers: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  return {
    cookies,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("getSessionToken", () => {
  it("prioritizes a valid bearer token for native clients", () => {
    expect(getSessionToken(request({ authorization: `Bearer ${token}` }, { session: "b".repeat(43) }), "session")).toBe(token);
  });

  it("keeps cookie authentication for the web client", () => {
    expect(getSessionToken(request({}, { session: token }), "session")).toBe(token);
  });

  it("rejects malformed credentials", () => {
    expect(getSessionToken(request({ authorization: "Bearer invalid token" }), "session")).toBeUndefined();
  });
});
