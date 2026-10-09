#!/usr/bin/env python3
"""Read-only SQLite/PostgreSQL structural and row-count comparison.

Usage:
  DATABASE_URL=postgresql://... python3 packages/database/scripts/compare_databases.py \
    --sqlite migration-import-001/hipersales-migration-snapshot.sqlite3

Runs no DDL or DML. A passing result means only schema/count parity, NOT API compatibility.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import sqlite3
import sys

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, required=True)
    args = parser.parse_args()
    if not args.sqlite.is_file():
        parser.error(f"SQLite snapshot not found: {args.sqlite}")
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn.startswith(("postgresql://", "postgres://")):
        parser.error("DATABASE_URL must point to a PostgreSQL database")
    try:
        import psycopg
    except ImportError:
        parser.error("Install psycopg[binary] first")
    failures = []
    with sqlite3.connect(f"file:{args.sqlite.resolve()}?mode=ro", uri=True) as source, psycopg.connect(dsn) as target:
        source.row_factory = sqlite3.Row
        check = source.execute("PRAGMA integrity_check").fetchone()[0]
        if check != "ok":
            failures.append(f"SQLite integrity failure: {check}")
        tables = [r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        with target.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
            pg_tables = {r[0] for r in cur.fetchall()}
            for table in sorted(tables):
                if table not in pg_tables:
                    failures.append(f"Missing PostgreSQL table: {table}")
                    continue
                sqlite_columns = {r["name"] for r in source.execute(f'PRAGMA table_info("{table}")')}
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (table,))
                pg_columns = {r[0] for r in cur.fetchall()}
                if sqlite_columns != pg_columns:
                    failures.append(f"Columns differ in {table}: missing={sorted(sqlite_columns-pg_columns)}, extra={sorted(pg_columns-sqlite_columns)}")
                # Table names are sourced from the local SQLite catalog; quote identifiers defensively.
                identifier = '"' + table.replace('"', '""') + '"'
                cur.execute(f"SELECT COUNT(*) FROM public.{identifier}")
                pg_count = cur.fetchone()[0]
                sqlite_count = source.execute(f"SELECT COUNT(*) FROM {identifier}").fetchone()[0]
                print(f"{table}: sqlite={sqlite_count}, postgres={pg_count}, columns={len(sqlite_columns)}")
                if sqlite_count != pg_count:
                    failures.append(f"Row count differs in {table}")
            extras = pg_tables-set(tables)
            for table in sorted(extras):
                print(f"PostgreSQL-only table: {table}")
    if failures:
        for failure in failures:
            print("FAIL:", failure, file=sys.stderr)
        return 1
    print("STRUCTURE AND ROW COUNTS MATCH. This does not verify data contents or API behavior.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
