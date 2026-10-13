/**
 * Transitional translator for the legacy SQLite-shaped SQL statements.
 * It is deliberately fail-closed for unsupported mutations, rather than
 * silently issuing an incorrect T-SQL statement.
 */
export function toSqlServerSelect(source: string): string {
  let sql = source.trim().replace(/;$/, "");
  if (!/^SELECT\b/i.test(sql)) throw new Error("Only SELECT is supported by the SQL Server bridge.");
  if (/\b(?:ILIKE|ON\s+CONFLICT|RETURNING|INSERT|UPDATE|DELETE|PRAGMA|sqlite_master)\b/i.test(sql)) {
    throw new Error("Unsupported SQL syntax in SQL Server bridge.");
  }
  sql = sql
    .replace(/datetime\s*\(\s*'now'\s*,\s*'-7 days'\s*\)/gi, "DATEADD(day, -7, SYSUTCDATETIME())")
    .replace(/\bgroup_concat\s*\(([^,]+),\s*'([^']*)'\s*\)/gi, "STRING_AGG($1, '$2')")
    .replace(/\b(?:CURRENT_TIMESTAMP)\b/gi, "SYSUTCDATETIME()");
  // SQL Server supports TOP for SELECT ... LIMIT N with no OFFSET.
  const limit = /\s+LIMIT\s+(\d+)\s*$/i.exec(sql);
  if (limit) {
    sql = sql.slice(0, limit.index);
    sql = sql.replace(/^SELECT\s+/i, "SELECT TOP (" + limit[1] + ") ");
  }
  if (/\bLIMIT\b|\bOFFSET\b/i.test(sql)) throw new Error("Pagination requires explicit T-SQL conversion.");
  // Preserve ? placeholders; they are bound by the SQL Server driver, not interpolated.
  // For a full migration this will be integrated into the parameterized request layer.
  return sql;
}

/**
 * Bind legacy positional placeholders into SQL Server named parameters.
 * Quotes, bracket identifiers and SQL comments are skipped; malformed
 * statements fail closed. Values must be bound separately by the driver.
 */
export function bindSqlServerParameters(statement: string, values: readonly unknown[]): {
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
        sql += "@p" + index++;
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
  return { sql, bindings: values.map((value, i) => ({ name: "p" + i, value })) };
}
