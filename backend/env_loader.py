from __future__ import annotations

"""Carregamento pequeno e sem dependencias do arquivo .env da aplicacao."""

import json
import os
import re
from pathlib import Path


ENV_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _decode_value(raw_value: str) -> str:
    value = raw_value.strip()
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        return str(json.loads(value))
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return re.split(r"\s+#", value, maxsplit=1)[0].strip()


def load_env_file(path: Path) -> None:
    """Carrega variaveis ausentes sem sobrescrever o ambiente do processo."""

    if not path.is_file():
        return
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise RuntimeError(f"Linha invalida em {path}:{line_number}.")
        name, raw_value = line.split("=", 1)
        name = name.strip()
        if not ENV_NAME_PATTERN.fullmatch(name):
            raise RuntimeError(f"Nome de variavel invalido em {path}:{line_number}.")
        os.environ.setdefault(name, _decode_value(raw_value))
