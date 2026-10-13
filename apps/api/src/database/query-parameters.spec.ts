import { describe, expect, it } from "vitest";
import { bindParameters, prepareSelect } from "./query-parameters.js";

describe("query validation", () => {
  it("accepts a single native SELECT", () => {
    expect(prepareSelect(" SELECT TOP (1) * FROM users; ")).toBe("SELECT TOP (1) * FROM users");
  });
  it("refuses mutation statements", () => {
    expect(() => prepareSelect("DELETE FROM users WHERE id = ?")).toThrow();
    expect(() => prepareSelect("INSERT INTO users (name) VALUES (?)")).toThrow();
  });
  it("refuses multiple statements", () => {
    expect(() => prepareSelect("SELECT 1; SELECT 2")).toThrow();
  });
});

describe("safe parameter binding", () => {
  it("binds parameter values without injecting into SQL", () => {
    const value = "'; DROP TABLE users;--";
    expect(bindParameters("SELECT * FROM users WHERE email = ?", [value])).toEqual({
      sql: "SELECT * FROM users WHERE email = @P1",
      bindings: [{ name: "P1", value }],
    });
  });
  it("ignores question marks inside literal strings and comments", () => {
    const query = "SELECT '?' AS question, id FROM users WHERE id = ? -- ?";
    expect(bindParameters(query, [42]).sql)
      .toBe("SELECT '?' AS question, id FROM users WHERE id = @P1 -- ?");
  });
  it("rejects missing and extra parameters", () => {
    expect(() => bindParameters("SELECT * FROM users WHERE id = ?", [])).toThrow();
    expect(() => bindParameters("SELECT * FROM users", [12])).toThrow();
  });
});
