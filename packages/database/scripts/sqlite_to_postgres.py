#!/usr/bin/env python3
"""SQLite -> PostgreSQL one-shot data transfer (not an API backend switch).

Requires: pgloader, psql, pg_dump and a completely empty target PostgreSQL schema.
Runs a SQLite online backup, checks integrity, and imports from that frozen copy.
Never modifies the source SQLite database. PostgreSQL target must be disposable/empty.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SQLITE = ROOT / "database" / "hypersales.sqlite3"


def command(args: list[str], *, capture=True) -> str:
    result = subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=DEFAULT_SQLITE)
    parser.add_argument("--backup-dir", type=Path, required=True)
    parser.add_argument("--execute", action="store_true", help="Actually import the frozen backup")
    args = parser.parse_args()
    source = args.sqlite.expanduser().resolve()
    if not source.is_file():
        parser.error(f"SQLite source not found: {source}")
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        parser.error("Set DATABASE_URL for a dedicated, EMPTY PostgreSQL database")
    target = urlsplit(database_url)
    if target.scheme not in {"postgres", "postgresql"} or not target.hostname or not target.path.strip("/"):
        parser.error("DATABASE_URL must be a PostgreSQL URL with a database name")
    args.backup_dir.mkdir(parents=True, exist_ok=True)
    backup_dir = args.backup_dir.resolve()
    backup = backup_dir / "hipersales-migration-snapshot.sqlite3"
    if backup.exists():
        parser.error(f"Backup already exists: {backup}. Select an unused --backup-dir.")
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as original:
        with sqlite3.connect(backup) as copy:
            original.backup(copy)
    os.chmod(backup, 0o600)
    with sqlite3.connect(f"file:{backup}?mode=ro", uri=True) as copy:
        integrity = copy.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity check failed: {integrity}")
        tables = {row[0]: copy.execute('SELECT COUNT(*) FROM "' + row[0].replace('"','""') + '"').fetchone()[0]
                  for row in copy.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    print(f"Snapshot: {backup}")
    print(f"SQLite integrity: {integrity}; {len(tables)} tables; {sum(tables.values())} rows")
    for name, count in sorted(tables.items()):
        print(f"  {name}: {count}")
    if not args.execute:
        print("DRY RUN ONLY. To import into an EMPTY database, repeat with --execute and a NEW backup directory.")
        return

    # psql checks do not interpolate credentials or table names in SQL.
    command(["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc", "SELECT 1"])
    count = command(["psql", database_url, "-X", "-v", "ON_ERROR_STOP=1", "-Atc",
                     "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"])
    if int(count) != 0:
        raise RuntimeError("Target PostgreSQL public schema is not empty. Import aborted.")

    # pgloader accepts URLs in a load file rather than exposing the destination password in argv.
    # pgloader uses its own schema type conversions and creates tables/indexes/sequences.
    uri = "sqlite://" + quote(str(backup), safe="/")
    with tempfile.TemporaryDirectory(prefix="hipersales-pgloader-") as directory:
        loadfile = Path(directory) / "migration.load"
        loadfile.write_text(f"LOAD DATABASE\n FROM {uri}\n INTO {database_url}\n WITH include drop, create tables, create indexes, reset sequences, foreign keys;\n", encoding="utf-8")
        os.chmod(loadfile, 0o600)
        command(["pgloader", str(loadfile)], capture=False)
    # Check table counts before approving the result. No cutover is performed.
    pg_tables = command(["psql", database_url, "-X", "-Atc",
                         "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'"])
    target_tables = set(pg_tables.splitlines())
    missing = set(tables) - target_tables
    if missing:
        raise RuntimeError(f"Migration incomplete, tables absent: {sorted(missing)}")
    for name, expected in sorted(tables.items()):
        safe_name = name.replace('"', '""')
        value = command(["psql", database_url, "-X", "-Atc", f'SELECT count(*) FROM public."{safe_name}"'])
        if int(value) != expected:
            raise RuntimeError(f"Count mismatch {name}: SQLite={expected}, PostgreSQL={value}")
    print("TRANSFER CHECK PASSED: counts match. API REMAINS ON SQLITE until PostgreSQL backend adapter is implemented and verified.")


if __name__ == "__main__":
    main()
