export function prepareSelect(source: string): string {
  const statement = source.trim().replace(/;$/, "");
  if (!/^SELECT\b/i.test(statement)) throw new Error("Only SELECT statements are accepted by query().");
  if (statement.includes(";")) throw new Error("Multiple SQL statements are not allowed.");
  return statement;
}

/**
 * Bind positional placeholders into driver named parameters.
 * Quotes, bracket identifiers and SQL comments are skipped; malformed
 * statements fail closed. Values must be bound separately by the driver.
 */
export function bindParameters(statement: string, values: readonly unknown[]): {
  sql: string;
  bindings: ReadonlyArray<{ name: string; value: unknown }>;
} {
  let sql = "";
  let index = 0;
  let state: "code" | "single" | "double" | "bracket" | "line" | "block" = "code";
  for (let i = 0; i < statement.length; i++) {
    const c = statement[i]!;
    const next = statement[i + 1];
    if (state === "code") {
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "[") state = "bracket";
      else if (c === "-" && next === "-") { state = "line"; sql += c; continue; }
      else if (c === "/" && next === "*") { state = "block"; sql += c; continue; }
      else if (c === "?") {
        if (index >= values.length) throw new Error("Not enough SQL parameters.");
        sql += "@P" + ++index;
        continue;
      }
    } else if (state === "single" && c === "'") {
      if (next === "'") { sql += c + next; i++; continue; }
      state = "code";
    } else if (state === "double" && c === '"') {
      if (next === '"') { sql += c + next; i++; continue; }
      state = "code";
    } else if (state === "bracket" && c === "]") {
      if (next === "]") { sql += c + next; i++; continue; }
      state = "code";
    } else if (state === "line" && c === "\n") state = "code";
    else if (state === "block" && c === "*" && next === "/") { sql += c + next; i++; state = "code"; continue; }
    sql += c;
  }
  if (index !== values.length) throw new Error("Too many SQL parameters.");
  if (state === "single" || state === "double" || state === "bracket" || state === "block") {
    throw new Error("Unterminated SQL token.");
  }
  return { sql, bindings: values.map((value, i) => ({ name: "P" + (i + 1), value })) };
}
