import { describe, expect, it } from "vitest";
import { bindSqlServerParameters, toSqlServerSelect } from "./sqlserver-dialect.js";

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

describe("SQL Server safe parameter binding", () => {
  it("binds parameter values without injecting into SQL", () => {
    const value = "'; DROP TABLE users;--";
    expect(bindSqlServerParameters("SELECT * FROM users WHERE email = ?", [value])).toEqual({
      sql: "SELECT * FROM users WHERE email = @p0",
      bindings: [{ name: "p0", value }],
    });
  });
  it("ignores question marks inside literal strings and comments", () => {
    const query = "SELECT '?' AS question, id FROM users WHERE id = ? -- ?";
    expect(bindSqlServerParameters(query, [42]).sql)
      .toBe("SELECT '?' AS question, id FROM users WHERE id = @p0 -- ?");
  });
  it("rejects missing and extra parameters", () => {
    expect(() => bindSqlServerParameters("SELECT * FROM users WHERE id = ?", [])).toThrow();
    expect(() => bindSqlServerParameters("SELECT * FROM users", [12])).toThrow();
  });
});
