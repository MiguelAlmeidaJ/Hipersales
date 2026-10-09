#!/usr/bin/env python3
"""List potentially incompatible SQLite SQL constructs before PostgreSQL cutover.

Usage: python3 apps/api/scripts/audit_sqlite_dialect.py
This is an inventory, not a compatibility certificate.
"""
from pathlib import Path
import sys

API = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))
from postgres_adapter import sql_dialect_report


def main():
    total: dict[str, int] = {}
    for source in sorted(API.glob("*.py")):
        if source.name == "postgres_adapter.py":
            continue
        report = sql_dialect_report(source.read_text(encoding="utf-8"))
        findings = {name: number for name, number in report.items() if number}
        if findings:
            print(f"{source.name}: {findings}")
        for name, number in report.items():
            total[name] = total.get(name, 0) + number
    print(f"TOTAL: {total}")
    hard_blockers = ["insert_or_ignore", "sqlite_master", "pragma", "autoincrement", "lastrowid", "changes_function", "strftime_function"]
    if any(total.get(name, 0) for name in hard_blockers):
        print("POSTGRESQL CUTOVER BLOCKED: dialect-specific constructs require conversion.")
        raise SystemExit(1)
    print("Static dialect audit found no listed blockers; integration testing is still required.")


if __name__ == "__main__":
    main()
