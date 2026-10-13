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
