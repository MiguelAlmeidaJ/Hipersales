#!/usr/bin/env python3
"""Read-only PostgreSQL connection smoke test; does not switch the API backend."""
import argparse
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from postgres_adapter import PostgreSQLConnection

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    args = parser.parse_args()
    if not args.database_url:
        parser.error("Set DATABASE_URL or pass --database-url")
    with PostgreSQLConnection(args.database_url) as conn:
        result = conn.execute("SELECT current_database() AS database_name, current_user AS database_user, 1 AS ok").fetchone()
        if result["ok"] != 1:
            raise RuntimeError("PostgreSQL smoke test failed")
        print(f"Connected to database {result['database_name']} as {result['database_user']}")
        print("This tests connectivity only; SQLite remains the production backend.")

if __name__ == "__main__":
    main()
