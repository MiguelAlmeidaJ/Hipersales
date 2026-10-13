import { describe, expect, it } from "vitest";
import { bindSqlServerParameters, toSqlServerSelect } from "../src/database/sqlserver-dialect.js";

describe("SQL Server bridge", () => {
  it("binds values separately from SQL text", () => {
    const value = "x'; DROP TABLE users; --";
    expect(bindSqlServerParameters("SELECT * FROM users WHERE email = ?", [value])).toEqual({
      sql: "SELECT * FROM users WHERE email = @p0",
      bindings: [{ name: "p0", value }],
    });
  });
  it("preserves ? inside literals and comments", () => {
    expect(bindSqlServerParameters("SELECT '?' AS label, id FROM users WHERE id = ? -- ?", [1]).sql)
      .toBe("SELECT '?' AS label, id FROM users WHERE id = @p0 -- ?");
  });
  it("refuses missing or extra parameters", () => {
    expect(() => bindSqlServerParameters("SELECT id FROM users WHERE id = ?", [])).toThrow();
    expect(() => bindSqlServerParameters("SELECT id FROM users", [1])).toThrow();
  });
  it("translates top-one lookups", () => {
    expect(toSqlServerSelect("SELECT id FROM users WHERE email = ? LIMIT 1"))
      .toBe("SELECT TOP (1) id FROM users WHERE email = ?");
  });
  it("rejects unsupported writes and OFFSET", () => {
    expect(() => toSqlServerSelect("DELETE FROM users WHERE id = ?")).toThrow();
    expect(() => toSqlServerSelect("SELECT * FROM users LIMIT 1 OFFSET 2")).toThrow();
  });
});
