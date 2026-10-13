import { describe, expect, it } from "vitest";
import { toSqlServerSelect } from "./sqlserver-dialect.js";

describe("SQL Server legacy query translation", () => {
  it("converts a simple LIMIT to TOP", () => {
    expect(toSqlServerSelect("SELECT * FROM users WHERE id = ? LIMIT 1"))
      .toBe("SELECT TOP (1) * FROM users WHERE id = ?");
  });
  it("converts a UTC date window", () => {
    expect(toSqlServerSelect("SELECT * FROM sessions WHERE created_at > datetime('now', '-7 days')"))
      .toContain("DATEADD(day, -7, SYSUTCDATETIME())");
  });
  it("refuses mutation statements", () => {
    expect(() => toSqlServerSelect("DELETE FROM users WHERE id = ?")).toThrow();
    expect(() => toSqlServerSelect("INSERT INTO users (name) VALUES (?)")).toThrow();
  });
  it("refuses unsupported OFFSET pagination", () => {
    expect(() => toSqlServerSelect("SELECT * FROM users LIMIT 10 OFFSET 20")).toThrow();
  });
});
