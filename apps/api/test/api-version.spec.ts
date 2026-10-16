import { PATH_METADATA } from "@nestjs/common/constants";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../src/health/health.controller.js";
import { API_VERSION } from "../src/common/api-version.js";
import { ApiVersionMiddleware } from "../src/common/middleware/api-version.middleware.js";

describe("API versioning", () => {
  it("publishes controllers on v1 while keeping the legacy route", () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toEqual(["api", "api/v1"]);
  });

  it("identifies versioned responses with a header", () => {
    const setHeader = vi.fn();
    const next = vi.fn() as NextFunction;
    new ApiVersionMiddleware().use(
      { originalUrl: "/api/v1/health" } as Request,
      { setHeader } as unknown as Response,
      next,
    );
    expect(setHeader).toHaveBeenCalledWith("X-API-Version", API_VERSION);
    expect(next).toHaveBeenCalledOnce();
  });
});
