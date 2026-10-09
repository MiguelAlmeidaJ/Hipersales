"""PostgreSQL adapter foundation for the legacy Python API.

Opt-in infrastructure only: switching the application to this adapter requires
migrating its DDL, SQL dialect and rowid-dependent flows. It is deliberately
NOT installed as a replacement for foundation.connect() yet.
"""
from __future__ import annotations

import re
from typing import Any


def translate_qmark(sql: str) -> str:
    """Convert DB-API qmark placeholders without touching SQL literals/comments.

    Percent signs are escaped for psycopg's pyformat protocol.
    """
    out: list[str] = []
    state = "normal"
    i = 0
    while i < len(sql):
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""
        if state == "normal":
            if ch == "'":
                state = "single"
            elif ch == '"':
                state = "double"
            elif ch == "-" and nxt == "-":
                state = "line"
                out.append("--")
                i += 2
                continue
            elif ch == "/" and nxt == "*":
                state = "block"
                out.append("/*")
                i += 2
                continue
            if ch == "?":
                out.append("%s")
            elif ch == "%":
                out.append("%%")
            else:
                out.append(ch)
        elif state == "single":
            out.append("%%" if ch == "%" else ch)
            if ch == "'" and nxt == "'":
                out.append(nxt)
                i += 2
                continue
            if ch == "'":
                state = "normal"
        elif state == "double":
            out.append("%%" if ch == "%" else ch)
            if ch == '"' and nxt == '"':
                out.append(nxt)
                i += 2
                continue
            if ch == '"':
                state = "normal"
        elif state == "line":
            out.append("%%" if ch == "%" else ch)
            if ch == "\n":
                state = "normal"
        else:
            out.append("%%" if ch == "%" else ch)
            if ch == "*" and nxt == "/":
                out.append("/")
                i += 2
                state = "normal"
                continue
        i += 1
    return "".join(out)



def translate_insert_or_ignore(sql: str) -> str:
    """Translate SQLite INSERT OR IGNORE into PostgreSQL ON CONFLICT DO NOTHING.

    Only standalone INSERT statements are accepted. Complex SQL and scripts
    must be ported explicitly rather than guessed.
    """
    if not re.match(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+", sql, re.IGNORECASE):
        return sql
    if ";" in sql.rstrip().rstrip(";") or re.search(r"\bON\s+CONFLICT\b", sql, re.IGNORECASE):
        raise ValueError("Review complex INSERT OR IGNORE manually before PostgreSQL migration")
    translated = re.sub(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", sql, count=1, flags=re.IGNORECASE)
    stripped = translated.rstrip()
    if stripped.endswith(";"):
        return stripped[:-1] + " ON CONFLICT DO NOTHING;"
    return stripped + " ON CONFLICT DO NOTHING"


def translate_simple_dml(sql: str) -> str:
    """Convert limited SQLite DML; refuse constructs needing semantic review."""
    if re.search(r"\b(?:PRAGMA|sqlite_master|INSERT\s+OR\s+REPLACE)\b", sql, re.IGNORECASE):
        raise ValueError("SQLite-specific query needs explicit PostgreSQL implementation")
    return translate_qmark(translate_insert_or_ignore(sql))

def postgresql_connect(dsn: str):
    """Obtain an explicit PostgreSQL connection with dict-like rows.

    Import psycopg lazily: existing SQLite deployments need no extra dependency.
    """
    if not dsn or not dsn.startswith(("postgres://", "postgresql://")):
        raise ValueError("A PostgreSQL DSN is required")
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError("Install psycopg[binary] before enabling PostgreSQL") from exc
    return psycopg.connect(dsn, row_factory=dict_row, autocommit=False)


class PostgreSQLConnection:
    """Explicitly opt-in connection facade for validating existing DML.

    Not wired into the production API until migrations and all SQL dialect
    differences have been resolved. Preserves context manager transactions.
    """

    def __init__(self, dsn: str):
        self._connection = postgresql_connect(dsn)

    def execute(self, sql: str, parameters: tuple[Any, ...] | list[Any] = ()):
        translated = translate_simple_dml(sql)
        return self._connection.execute(translated, parameters)

    def executemany(self, sql: str, parameters):
        translated = translate_simple_dml(sql)
        with self._connection.cursor() as cursor:
            cursor.executemany(translated, parameters)
            return cursor

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        try:
            if exc_type is None:
                self.commit()
            else:
                self.rollback()
        finally:
            self.close()
        return False


def sql_dialect_report(text: str) -> dict[str, int]:
    """Inventory SQLite-only constructs for migration planning and regression checks."""
    patterns = {
        "qmark_parameters": r"(?<!\\)\?",
        "insert_or_ignore": r"\bINSERT\s+OR\s+IGNORE\b",
        "sqlite_master": r"\bsqlite_master\b",
        "pragma": r"\bPRAGMA\b",
        "autoincrement": r"\bAUTOINCREMENT\b",
        "lastrowid": r"\.lastrowid\b",
        "changes_function": r"\bchanges\s*\(",
        "strftime_function": r"\bstrftime\s*\(",
    }
    return {name: len(re.findall(pattern, text, flags=re.IGNORECASE)) for name, pattern in patterns.items()}
