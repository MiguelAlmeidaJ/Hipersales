#!/usr/bin/env python3
"""Promove um usuário existente da HiperMix a Dev sem redefinir a senha."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from foundation import DB_PATH, connect, normalize_username


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", help="Login existente (pode ser informado interativamente)")
    args = parser.parse_args()
    username = normalize_username(args.username or input("Login do usuario existente: "))
    if not username:
        parser.error("Informe o login.")
    if not DB_PATH.is_file():
        parser.error(f"Banco SQLite nao encontrado: {DB_PATH}")
    with connect() as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "is_dev" not in columns:
            parser.error("Coluna is_dev ausente. Reinicie a API atualizada para aplicar as migracoes.")
        user = conn.execute(
            "SELECT id, name, email, role, active, is_dev FROM users WHERE email = ?", (username,)
        ).fetchone()
        if user is None:
            parser.error("Usuario nao encontrado. Nenhuma alteracao realizada.")
        print(f"Usuario: {user['name']} | login: {user['email']} | perfil: {user['role']}")
        if user["is_dev"]:
            print("Este usuario ja possui acesso Dev.")
            return
        if not user["active"]:
            parser.error("Usuario inativo. Ative-o pelo fluxo administrativo antes da promocao.")
        if input("Promover este usuario a Dev (acesso administrativo completo)? [s/N]: ").strip().lower() != "s":
            print("Operacao cancelada.")
            return
        conn.execute(
            "UPDATE users SET role = 'admin', is_dev = 1, tenant_id = 1 WHERE id = ?",
            (user["id"],),
        )
    print(f"Usuario {username} promovido a Dev. Senha e nome preservados.")


if __name__ == "__main__":
    main()
