#!/usr/bin/env python3
"""Create or upgrade one HiperMix developer account using interactive input."""
from __future__ import annotations
import argparse
from getpass import getpass
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"apps"/"api"))
from foundation import connect, hash_password, normalize_username, now_iso, validate_bootstrap_password, DB_PATH

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name")
    parser.add_argument("--username")
    args=parser.parse_args()
    name=(args.name or input("Nome completo: ")).strip()
    username=normalize_username(args.username or input("Login: "))
    if not name or not username:
        parser.error("Nome e login sao obrigatorios")
    password=getpass("Senha (minimo 12 caracteres): ")
    validate_bootstrap_password(password)
    if password!=getpass("Confirmar senha: "):
        parser.error("Senhas diferentes")
    if not DB_PATH.is_file():
        parser.error(f"SQLite nao encontrado: {DB_PATH}")
    with connect() as conn:
        columns={row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "is_dev" not in columns:
            parser.error("Banco ainda nao atualizado: reinicie a API para executar migrate_db")
        existing=conn.execute("SELECT id, name, is_dev FROM users WHERE email = ?",(username,)).fetchone()
        if existing:
            if input("Login existente. Promover/redefinir senha? [s/N]: ").strip().lower()!="s":
                print("Cancelado.");return
            conn.execute("""UPDATE users SET name=?, password_hash=?, role='admin', tenant_id=1,
                is_dev=1, is_super_admin=0, active=1, must_change_password=1, password_updated_at=?
                WHERE id=?""",(name,hash_password(password),now_iso(),existing["id"]))
            user_id=existing["id"]
        else:
            cur=conn.execute("""INSERT INTO users
                (tenant_id,name,email,password_hash,role,is_dev,is_super_admin,active,
                 must_change_password,password_updated_at,created_at)
                 VALUES (1,?,?,?,'admin',1,0,1,1,?,?)""",
                 (name,username,hash_password(password),now_iso(),now_iso()))
            user_id=cur.lastrowid
    print(f"Dev cadastrado: id={user_id}, login={username}")
    print("O usuario devera alterar a senha no primeiro acesso.")

if __name__=="__main__":
    main()
