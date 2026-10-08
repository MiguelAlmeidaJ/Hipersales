from __future__ import annotations

import base64
import hashlib
import hmac
import json
import sqlite3
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT_DIR / "CARGA_LEON.xlsx"
DB_PATH = ROOT_DIR / "database" / "hypersales.sqlite3"
DOMAIN = "hipermixrepresentacoes.com.br"
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_digits(value: str | None) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def normalize_spaces(value: str | None) -> str:
    return " ".join(str(value or "").split()).strip()


def humanize_username(username: str) -> str:
    parts = [part for part in str(username or "").strip().replace(".", "_").split("_") if part]
    return " ".join(part.capitalize() for part in parts) or "Usuario Importado"


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or uuid.uuid4().bytes[:16]
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 150_000)
    return base64.b64encode(salt + digest).decode("ascii")


def open_workbook(path: Path):
    zf = zipfile.ZipFile(path)
    sst: list[str] = []
    if "xl/sharedStrings.xml" in zf.namelist():
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        for si in root.findall("a:si", NS):
            texts = [t.text or "" for t in si.iterfind(".//a:t", NS)]
            sst.append("".join(texts))

    def cell_value(cell: ET.Element) -> str:
        value = cell.find("a:v", NS)
        if value is None:
            return ""
        text = value.text or ""
        if cell.attrib.get("t") == "s":
            return sst[int(text)]
        return text

    def rows(sheet_name: str) -> list[list[str]]:
        root = ET.fromstring(zf.read(sheet_name))
        parsed: list[list[str]] = []
        for row in root.findall(".//a:sheetData/a:row", NS):
            values = [cell_value(cell) for cell in row.findall("a:c", NS)]
            parsed.append(values)
        return parsed

    return zf, rows


def address_from_row(row: dict[str, str]) -> str:
    street = normalize_spaces(row.get("logradouro"))
    number = normalize_spaces(row.get("numero"))
    complement = normalize_spaces(row.get("complemento"))
    district = normalize_spaces(row.get("bairro_distrito"))
    city = normalize_spaces(row.get("cidade"))
    uf = normalize_spaces(row.get("uf"))
    cep = normalize_spaces(row.get("cep"))
    parts = []
    if street:
        parts.append(street)
    if number:
        parts.append(number)
    if complement:
        parts.append(complement)
    location = ", ".join(parts)
    tail = ", ".join(filter(None, [district, f"{city}/{uf}" if city and uf else city or uf, f"CEP {cep}" if cep else ""]))
    return " - ".join(filter(None, [location, tail]))


def iter_sheet_records(sheet_rows: list[list[str]]) -> list[dict[str, str]]:
    if not sheet_rows:
        return []
    header = [normalize_spaces(cell) for cell in sheet_rows[0]]
    records: list[dict[str, str]] = []
    for raw_row in sheet_rows[1:]:
        if not any(normalize_spaces(cell) for cell in raw_row):
            continue
        row = {header[idx]: normalize_spaces(raw_row[idx]) if idx < len(raw_row) else "" for idx in range(len(header))}
        records.append(row)
    return records


def upsert_user(conn: sqlite3.Connection, username: str, password: str, access: str) -> int:
    role = "admin" if "MASTER" in access.upper() else "seller"
    email = username.strip().lower().split("@", 1)[0]
    name = humanize_username(username)
    password_hash = hash_password(password)
    row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if row:
        conn.execute(
            """
            UPDATE users
            SET name = ?, password_hash = ?, role = ?, active = 1, must_change_password = 0
            WHERE id = ?
            """,
            (name, password_hash, role, row[0]),
        )
        return int(row[0])
    cur = conn.execute(
        """
        INSERT INTO users (name, email, password_hash, role, active, must_change_password, created_at)
        VALUES (?, ?, ?, ?, 1, 0, ?)
        """,
        (name, email, password_hash, role, now_iso()),
    )
    return int(cur.lastrowid)


def upsert_company(conn: sqlite3.Connection, name: str, legal_name: str) -> int:
    existing = conn.execute(
        "SELECT id FROM companies WHERE name = ? OR legal_name = ?",
        (name, legal_name),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE companies SET name = ?, legal_name = ?, active = 1 WHERE id = ?",
            (name, legal_name, existing[0]),
        )
        return int(existing[0])
    cur = conn.execute(
        "INSERT INTO companies (name, legal_name, active) VALUES (?, ?, 1)",
        (name, legal_name),
    )
    return int(cur.lastrowid)


def upsert_customer(conn: sqlite3.Connection, row: dict[str, str]) -> int | None:
    cnpj = normalize_digits(row.get("cnpj"))
    if not cnpj:
        return None
    legal_name = normalize_spaces(row.get("razao_social") or row.get("razão_social"))
    trade_name = normalize_spaces(row.get("nome_fantasia"))
    state_registration = normalize_spaces(row.get("insc_estadual"))
    address = address_from_row(row)
    payload = {
        "source": "CARGA_LEON.xlsx",
        "sheet": "CLIENTES",
        "imported_at": now_iso(),
        "row": row,
    }
    existing = conn.execute("SELECT id FROM customers WHERE cnpj = ?", (cnpj,)).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE customers
            SET legal_name = ?, trade_name = ?, state_registration = ?, address = ?, active = 1, form_payload = ?
            WHERE id = ?
            """,
            (legal_name, trade_name, state_registration, address, json.dumps(payload, ensure_ascii=False), existing[0]),
        )
        return int(existing[0])
    cur = conn.execute(
        """
        INSERT INTO customers
            (legal_name, trade_name, cnpj, state_registration, address, phone, email, active, created_at, form_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            legal_name,
            trade_name,
            cnpj,
            state_registration,
            address,
            "",
            "",
            now_iso(),
            json.dumps(payload, ensure_ascii=False),
        ),
    )
    return int(cur.lastrowid)


def main() -> None:
    if not XLSX_PATH.exists():
        raise SystemExit(f"Arquivo nao encontrado: {XLSX_PATH}")

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")

        with zipfile.ZipFile(XLSX_PATH) as zf:
            def read_rows(sheet_name: str) -> list[list[str]]:
                root = ET.fromstring(zf.read(sheet_name))
                return [[(cell.find("a:v", NS).text if cell.find("a:v", NS) is not None else "") for cell in row.findall("a:c", NS)] for row in root.findall(".//a:sheetData/a:row", NS)]

            def shared_strings() -> list[str]:
                items: list[str] = []
                if "xl/sharedStrings.xml" in zf.namelist():
                    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                    for si in root.findall("a:si", NS):
                        texts = [t.text or "" for t in si.iterfind(".//a:t", NS)]
                        items.append("".join(texts))
                return items

            sst = shared_strings()

            def decode_sheet(sheet_file: str) -> list[list[str]]:
                root = ET.fromstring(zf.read(sheet_file))
                rows: list[list[str]] = []
                for row in root.findall(".//a:sheetData/a:row", NS):
                    values: list[str] = []
                    for cell in row.findall("a:c", NS):
                        raw = cell.find("a:v", NS)
                        if raw is None:
                            values.append("")
                            continue
                        text = raw.text or ""
                        if cell.attrib.get("t") == "s":
                            values.append(sst[int(text)])
                        else:
                            values.append(text)
                    rows.append(values)
                return rows

            users_rows = iter_sheet_records(decode_sheet("xl/worksheets/sheet1.xml"))
            customer_rows = iter_sheet_records(decode_sheet("xl/worksheets/sheet2.xml"))
            customer_seller_rows = iter_sheet_records(decode_sheet("xl/worksheets/sheet3.xml"))
            company_rows = iter_sheet_records(decode_sheet("xl/worksheets/sheet4.xml"))
            product_rows = iter_sheet_records(decode_sheet("xl/worksheets/sheet5.xml"))

        user_ids: dict[str, int] = {}
        created_users = updated_users = 0
        for row in users_rows:
            username = normalize_spaces(row.get("Usuário:"))
            password = normalize_spaces(row.get("Senha:"))
            access = normalize_spaces(row.get("Acesso:"))
            if not username or not password:
                continue
            before = conn.execute("SELECT id FROM users WHERE email = ?", (username.strip().lower().split("@", 1)[0],)).fetchone()
            user_id = upsert_user(conn, username, password, access)
            user_ids[username] = user_id
            if before:
                updated_users += 1
            else:
                created_users += 1

        created_customers = updated_customers = 0
        customer_ids_by_cnpj: dict[str, int] = {}
        for row in customer_rows:
            cnpj = normalize_digits(row.get("cnpj"))
            if not cnpj:
                continue
            before = conn.execute("SELECT id FROM customers WHERE cnpj = ?", (cnpj,)).fetchone()
            customer_id = upsert_customer(conn, row)
            if customer_id is None:
                continue
            customer_ids_by_cnpj[cnpj] = customer_id
            if before:
                updated_customers += 1
            else:
                created_customers += 1

        created_links = 0
        for row in customer_seller_rows:
            cnpj = normalize_digits(row.get("cnpj"))
            seller_username = normalize_spaces(row.get("vendedor/usuario"))
            if not cnpj or not seller_username:
                continue
            customer_id = customer_ids_by_cnpj.get(cnpj)
            seller_id = user_ids.get(seller_username)
            if not customer_id or not seller_id:
                continue
            cur = conn.execute(
                "INSERT OR IGNORE INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)",
                (customer_id, seller_id),
            )
            created_links += cur.rowcount

        company_name_by_legal: dict[str, int] = {}
        created_companies = updated_companies = 0
        for row in company_rows:
            legal_name = normalize_spaces(row.get("razão_social") or row.get("razao_social"))
            name = normalize_spaces(row.get("nome_fantasia")) or legal_name
            if not legal_name and not name:
                continue
            before = conn.execute("SELECT id FROM companies WHERE name = ? OR legal_name = ?", (name, legal_name)).fetchone()
            company_id = upsert_company(conn, name, legal_name)
            company_name_by_legal[legal_name] = company_id
            if before:
                updated_companies += 1
            else:
                created_companies += 1

        created_products = updated_products = 0
        for row in product_rows:
            company_legal = normalize_spaces(row.get("Empresa_razao_social"))
            company_id = company_name_by_legal.get(company_legal)
            if not company_id:
                continue
            code = normalize_spaces(row.get("código_produto"))
            name = normalize_spaces(row.get("descrição_produto"))
            unit = normalize_spaces(row.get("unidade_produto")) or "UN"
            if not code or not name:
                continue
            existing = conn.execute(
                "SELECT id FROM products WHERE company_id = ? AND code = ?",
                (company_id, code),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE products SET name = ?, unit = ?, active = 1 WHERE id = ?",
                    (name, unit, existing[0]),
                )
                updated_products += 1
            else:
                conn.execute(
                    "INSERT INTO products (company_id, code, name, unit, price, active) VALUES (?, ?, ?, ?, 0, 1)",
                    (company_id, code, name, unit),
                )
                created_products += 1

        conn.commit()

    print(
        json.dumps(
            {
                "users_created": created_users,
                "users_updated": updated_users,
                "customers_created": created_customers,
                "customers_updated": updated_customers,
                "customer_links_created": created_links,
                "companies_created": created_companies,
                "companies_updated": updated_companies,
                "products_created": created_products,
                "products_updated": updated_products,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
