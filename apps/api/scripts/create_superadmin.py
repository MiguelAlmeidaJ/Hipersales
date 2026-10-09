#!/usr/bin/env python3
"""Criar ou redefinir superadministrador do Hipersales sem senha no .env."""
from __future__ import annotations

import argparse
from getpass import getpass
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from foundation import (
    DB_PATH, connect, hash_password, normalize_username, now_iso,
    validate_bootstrap_password,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", help="Nome do superadministrador")
    parser.add_argument("--username", help="Login do superadministrador")
    args = parser.parse_args()

    name = (args.name or input("Nome completo: ")).strip()
    username = normalize_username(args.username or input("Login: "))
    if not name or not username:
        parser.error("Nome e login sao obrigatorios")
    password = getpass("Senha (minimo 12 caracteres): ")
    validate_bootstrap_password(password)
    if password != getpass("Confirme a senha: "):
        parser.error("As senhas nao conferem")

    if not DB_PATH.is_file():
        parser.error(f"Banco SQLite nao encontrado: {DB_PATH}. Confira HYPERSALES_DB_PATH.")
    with connect() as conn:
        existing = conn.execute(
            "SELECT id, email FROM users WHERE COALESCE(is_super_admin,0)=1 ORDER BY id LIMIT 1"
        ).fetchone()
        conflict = conn.execute("SELECT id FROM users WHERE email=?", (username,)).fetchone()
        if conflict and (not existing or conflict["id"] != existing["id"]):
            parser.error("Login ja utilizado por outro usuario. Escolha outro.")
        if existing:
            print(f"Superadministrador existente: ID {existing['id']} ({existing['email']})")
            if input("Redefinir nome, login e senha deste usuario? [s/N]: ").strip().lower() != "s":
                print("Operacao cancelada, sem alteracoes.")
                return
            conn.execute(
                """UPDATE users
                   SET name=?, email=?, password_hash=?, role='admin',
                       is_super_admin=1, tenant_id=NULL, active=1,
                       must_change_password=1, password_updated_at=?
                   WHERE id=?""",
                (name, username, hash_password(password), now_iso(), existing["id"]),
            )
            user_id = existing["id"]
        else:
            cur = conn.execute(
                """INSERT INTO users
                (tenant_id,name,email,password_hash,role,is_super_admin,active,
                 must_change_password,password_updated_at,created_at)
                VALUES (NULL,?,?,?,'admin',1,1,1,?,?)""",
                (name, username, hash_password(password), now_iso(), now_iso()),
            )
            user_id = cur.lastrowid
    print(f"Superadministrador ID {user_id} pronto para login: {username}")
    print("A senha sera trocada no primeiro acesso.")


if __name__ == "__main__":
    main()
