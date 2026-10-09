#!/usr/bin/env python3
"""Create a verified, non-destructive SQLite snapshot for PostgreSQL rehearsal.

Pure Python; works on Windows and Linux. Does NOT import or switch the API.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
from datetime import datetime, timezone
from contextlib import closing
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from env_loader import load_env_file


def snapshot(source: Path, destination: Path) -> dict:
    source = source.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(f"SQLite source does not exist: {source}")
    if source == destination:
        raise ValueError("Snapshot destination must differ from SQLite source")
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Refuse replacing an existing snapshot, including after a failed run.
    with destination.open("xb"):
        pass
    try:
        src_uri = "file:" + quote(str(source).replace("\\", "/"), safe="/:") + "?mode=ro"
        with closing(sqlite3.connect(src_uri, uri=True)) as src, closing(sqlite3.connect(destination)) as dst:
            src.backup(dst)
        with closing(sqlite3.connect(destination)) as db:
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
            if integrity != "ok" or fk_errors:
                raise RuntimeError(f"Snapshot validation failed: integrity={integrity}, foreign_key_violations={len(fk_errors)}")
            names = [row[0] for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            tables = {}
            for name in names:
                identifier = '"' + name.replace('"', '""') + '"'
                tables[name] = db.execute(f"SELECT COUNT(*) FROM {identifier}").fetchone()[0]
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        manifest = {
            "snapshot": str(destination),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "integrity": integrity,
            "foreign_key_violations": 0,
            "sha256": digest,
            "table_counts": tables,
            "total_rows": sum(tables.values()),
        }
        manifest_path = destination.with_suffix(destination.suffix + ".manifest.json")
        with manifest_path.open("x", encoding="utf-8") as output:
            json.dump(manifest, output, indent=2, ensure_ascii=False)
        return manifest
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main() -> None:
    load_env_file(ROOT / ".env")
    default_source = Path(os.getenv("HYPERSALES_DB_PATH", "database/hypersales.sqlite3"))
    if not default_source.is_absolute():
        default_source = ROOT / default_source
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=default_source)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = snapshot(args.sqlite, args.output)
    print(f"Snapshot verified: {data['snapshot']}")
    print(f"Tables: {len(data['table_counts'])}; rows: {data['total_rows']}; SHA256: {data['sha256']}")
    print(f"Manifest: {Path(data['snapshot']).with_suffix(Path(data['snapshot']).suffix + '.manifest.json')}")
    print("Safe to use for migration rehearsal. Production SQLite and API connection are unchanged.")


if __name__ == "__main__":
    main()
