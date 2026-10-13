#!/usr/bin/env python3
"""Auditoria estatica de preparacao SQL Server; nao modifica arquivos/bancos."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
paths = [ROOT / "apps/api/src/database/database.service.ts"]
paths += sorted((ROOT / "apps/api/src").rglob("*.ts"))
patterns = {
    "PostgreSQL placeholders ($1...)": r"\\$[1-9][0-9]*",
    "ILIKE": r"\\bILIKE\\b",
    "ON CONFLICT": r"\\bON\\s+CONFLICT\\b",
    "RETURNING": r"\\bRETURNING\\b",
    "INTERVAL": r"\\bINTERVAL\\b",
    "PostgreSQL casting (::type)": r"::(?:text|timestamp|int|numeric|uuid)\\b",
    "PostgreSQL BOOLEAN literals": r"\\b(?:TRUE|FALSE)\\b",
    "PostgreSQL aggregations": r"\\bstring_agg\\s*\\(",
    "SQLite placeholders (?)": r"\\?",
}

print("SQL Server migration audit (heuristic; comments and strings may be counted)")
issues = 0
for path in dict.fromkeys(paths):
    if not path.exists():
        continue
    source = path.read_text(encoding="utf-8")
    for label, expr in patterns.items():
        for i, line in enumerate(source.splitlines(), 1):
            if re.search(expr, line, flags=re.IGNORECASE):
                print(f"{path.relative_to(ROOT)}:{i} [{label}] {line.strip()[:140]}")
                issues += 1
print(f"Found {issues} potential incompatibilities")
raise SystemExit(1 if issues else 0)
