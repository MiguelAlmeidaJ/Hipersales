#!/usr/bin/env python3
"""Non-destructive PostgreSQL readiness inspection against a frozen SQLite snapshot.

Checks schema, row counts, ID sequences and source integrity. No SQL writes,
no change to production API configuration. Requires psycopg 3.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import sqlite3
import sys

def ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sqlite", type=Path, required=True)
    args = ap.parse_args()
    if not args.sqlite.is_file():
        ap.error("SQLite snapshot does not exist")
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn.startswith(("postgresql://", "postgres://")):
        ap.error("DATABASE_URL must be a PostgreSQL URI")
    try:
        import psycopg
    except ImportError:
        ap.error("Install psycopg[binary] to inspect PostgreSQL")

    issues = []
    with sqlite3.connect(f"file:{args.sqlite.resolve()}?mode=ro", uri=True) as db, psycopg.connect(dsn) as pg:
        db.row_factory = sqlite3.Row
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            issues.append(f"SQLite integrity check: {integrity}")
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        with pg.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
            available = {r[0] for r in cur.fetchall()}
            for table in tables:
                if table not in available:
                    issues.append(f"Missing table: {table}")
                    continue
                src_cols = {r["name"]: r for r in db.execute(f"PRAGMA table_info({ident(table)})")}
                cur.execute("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (table,))
                pg_cols = {r[0]: r[1] for r in cur.fetchall()}
                for col in set(src_cols) - set(pg_cols):
                    issues.append(f"{table}: missing column {col}")
                cur.execute(f"SELECT COUNT(*) FROM public.{ident(table)}")
                pg_count = cur.fetchone()[0]
                src_count = db.execute(f"SELECT COUNT(*) FROM {ident(table)}").fetchone()[0]
                if pg_count != src_count:
                    issues.append(f"{table}: row count differs sqlite={src_count} postgres={pg_count}")
                if "id" in src_cols and "id" in pg_cols and src_cols["id"]["pk"]:
                    cur.execute("SELECT pg_get_serial_sequence(%s, %s)", (f"public.{ident(table)}", "id"))
                    sequence = cur.fetchone()[0]
                    if sequence:
                        cur.execute(f"SELECT COALESCE(MAX(id), 0) FROM public.{ident(table)}")
                        max_id = cur.fetchone()[0]
                        cur.execute("SELECT last_value, is_called FROM pg_sequences WHERE schemaname='public' AND sequencename=%s", (sequence.rsplit(".", 1)[-1].strip('"'),))
                        # pg_sequences does not expose is_called; inspect last_value only.
                        row = cur.fetchone() if False else None
                        cur.execute("SELECT last_value FROM pg_sequences WHERE schemaname='public' AND sequencename=%s", (sequence.rsplit(".", 1)[-1].strip('"'),))
                        last = cur.fetchone()
                        if last is not None and last[0] is not None and last[0] < max_id:
                            issues.append(f"{table}: sequence {sequence} behind max id {max_id}")
                    else:
                        issues.append(f"{table}: id column has no associated sequence")
                print(f"{table}: {src_count} rows, {len(src_cols)} SQLite columns, {len(pg_cols)} PostgreSQL columns")
    for issue in issues:
        print(f"BLOCKER: {issue}", file=sys.stderr)
    if issues:
        print(f"NOT READY: {len(issues)} schema/data blockers; no cutover performed.")
        return 1
    print("SCHEMA READINESS CHECK PASSED. API SQL dialect and end-to-end tests are still required.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
