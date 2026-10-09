#!/usr/bin/env python3
"""Export the actual SQLite schema (DDL only) for Hipersales migration auditing.

Read-only: never opens the source database in write mode and never exports data.
Usage:
  python packages/database/scripts/export_legacy_schema.py --sqlite database/hypersales.sqlite3 --output docs/legacy-schema.sql
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sqlite3
from urllib.parse import quote


def export_schema(source: Path) -> str:
    source = source.expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(f"SQLite database not found: {source}")
    uri = "file:" + quote(source.as_posix(), safe="/:") + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity_check failed: {integrity}")
        objects = conn.execute(
            """
            SELECT type, name, sql
            FROM sqlite_master
            WHERE type IN ('table', 'index', 'view', 'trigger')
              AND name NOT LIKE 'sqlite_%'
              AND sql IS NOT NULL
            ORDER BY CASE type
                WHEN 'table' THEN 0
                WHEN 'index' THEN 1
                WHEN 'view' THEN 2
                ELSE 3 END, name
            """
        ).fetchall()
    if not objects:
        raise RuntimeError("No schema objects found in the SQLite database.")
    lines = [
        "-- Hipersales SQLite schema (structure only; no customer or user data).",
        "-- Extracted from the actual database; run against SQLite only.",
        "-- Review and convert syntax/constraints before applying to PostgreSQL.",
        "BEGIN TRANSACTION;",
        "",
    ]
    for kind, name, ddl in objects:
        lines.extend([f"-- {kind}: {name}", ddl.rstrip().rstrip(";") + ";", ""])
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, required=True, help="Path to the original SQLite database")
    parser.add_argument("--output", type=Path, required=True, help="Path to create schema-only .sql")
    args = parser.parse_args()
    source = args.sqlite.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if source == output:
        parser.error("Output must not overwrite the database.")
    ddl = export_schema(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        stream.write(ddl)
    count = ddl.count("-- table:")
    print(f"Exported {count} tables and other schema objects to {output}")
    print("No database records were exported.")


if __name__ == "__main__":
    main()
