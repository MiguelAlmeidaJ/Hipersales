import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvService } from "../src/config/env.service.js";

describe("EnvService database credentials", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects the sa login in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "SQLSERVER_DATABASE_URL",
      "sqlserver://database:1433;database=hipersales; USER = {SA};password={secret};encrypt=true;trustServerCertificate=false",
    );

    expect(() => new EnvService()).toThrow(/nao pode usar o login administrativo sa/i);
  });

  it("accepts a dedicated application login in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "SQLSERVER_DATABASE_URL",
      "sqlserver://database:1433;database=hipersales;user=hipersales_app;password={secret};encrypt=true;trustServerCertificate=false",
    );

    expect(new EnvService().databaseUrl).toContain("user=hipersales_app");
  });
});
