from __future__ import annotations

"""Configuração, persistência, segurança, settings e integrações compartilhadas."""




import base64
import csv
import gzip
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import shutil
import sqlite3
import smtplib
import ssl
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    from .env_loader import load_env_file
except ImportError:  # Execucao direta: python backend/app.py
    from env_loader import load_env_file


ROOT_DIR = Path(__file__).resolve().parents[2]


def resolve_env_path(value: str, default: Path) -> Path:
    candidate = Path(value).expanduser() if value.strip() else default
    return candidate if candidate.is_absolute() else ROOT_DIR / candidate


ENV_FILE = resolve_env_path(os.environ.get("HYPERSALES_ENV_FILE", ""), ROOT_DIR / ".env")
load_env_file(ENV_FILE)


def env_text(name: str, default: str = "") -> str:
    return str(os.environ.get(name, default)).strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = env_text(name)
    if not value:
        return default
    if value.lower() in {"1", "true", "yes", "sim", "on"}:
        return True
    if value.lower() in {"0", "false", "no", "nao", "off"}:
        return False
    raise RuntimeError(f"Valor booleano invalido para {name}.")


def env_int(name: str, default: int, minimum: int = 1) -> int:
    value = env_text(name)
    try:
        parsed = int(value) if value else default
    except ValueError as exc:
        raise RuntimeError(f"Valor inteiro invalido para {name}.") from exc
    if parsed < minimum:
        raise RuntimeError(f"{name} deve ser maior ou igual a {minimum}.")
    return parsed


FRONTEND_DIR = ROOT_DIR / "apps" / "web"
DB_PATH = resolve_env_path(env_text("HYPERSALES_DB_PATH"), ROOT_DIR / "database" / "hypersales.sqlite3")
DATABASE_DIR = DB_PATH.parent
SESSION_COOKIE = env_text("HYPERSALES_SESSION_COOKIE", "hypersales_session")
SESSION_TTL_SECONDS = env_int("HYPERSALES_SESSION_TTL_SECONDS", 60 * 60 * 12, 300)
SESSION_COOKIE_SECURE = env_bool("HYPERSALES_COOKIE_SECURE", False)
SESSION_COOKIE_SAMESITE = env_text("HYPERSALES_COOKIE_SAMESITE", "Lax").capitalize()
if SESSION_COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
    raise RuntimeError("HYPERSALES_COOKIE_SAMESITE deve ser Lax, Strict ou None.")
if SESSION_COOKIE_SAMESITE == "None" and not SESSION_COOKIE_SECURE:
    raise RuntimeError("Cookies SameSite=None exigem HYPERSALES_COOKIE_SECURE=true.")
WHATSAPP_AUTH_DIR = resolve_env_path(
    env_text("HYPERSALES_WHATSAPP_AUTH_DIR"),
    ROOT_DIR / "data" / "whatsapp-auth",
)
EVOLUTION_API_URL = env_text("EVOLUTION_API_URL", "http://127.0.0.1:8081").rstrip("/")
EVOLUTION_API_KEY_PATH = resolve_env_path(env_text("EVOLUTION_API_KEY_PATH"), Path("/opt/evolution/.apikey"))
PUBLIC_APP_URL = env_text("HYPERSALES_PUBLIC_URL", "https://hipersalesweb.com.br").rstrip("/")
try:
    REPORT_TIMEZONE = ZoneInfo(env_text("HYPERSALES_REPORT_TIMEZONE", "America/Sao_Paulo"))
except ZoneInfoNotFoundError as exc:
    raise RuntimeError("HYPERSALES_REPORT_TIMEZONE invalido.") from exc
WEEKLY_REPORT_SETTING_KEY = "weekly_reports_last_week"
GOAL_REMINDER_DAYS = {10, 15, 20, 25, 27, 28, 29, 30}
TENANT_CONTEXT: dict[int, dict[str, Any]] = {}

DEFAULT_SETTINGS: dict[str, Any] = {
    "customer_funnel": [
        {"name": "Solicitado", "color": "#0d6fd8"},
        {"name": "Em validacao", "color": "#e0ad2f"},
        {"name": "Aprovado", "color": "#5abf43"},
        {"name": "Recusado", "color": "#b42318"},
    ],
    "product_funnel": [
        {"name": "Cadastro", "color": "#0d6fd8"},
        {"name": "Em producao", "color": "#15a4d7"},
        {"name": "Liberado", "color": "#5abf43"},
        {"name": "Arquivado", "color": "#617287"},
    ],
    "order_statuses": [
        {"key": "em_analise", "name": "Em analise", "color": "#e0ad2f"},
        {"key": "pedido_aprovado", "name": "Pedido aprovado", "color": "#5abf43"},
        {"key": "recusado", "name": "Proposta recusada", "color": "#b42318"},
        {"key": "em_producao", "name": "Em producao", "color": "#15a4d7"},
        {"key": "faturado", "name": "Faturado", "color": "#0d6fd8"},
        {"key": "entregue", "name": "Pedido entregue", "color": "#128475"},
    ],
    "smtp": {
        "host": "",
        "port": 587,
        "username": "",
        "password": "",
        "from_name": "Hipersales",
        "from_email": "",
        "use_tls": True,
        "use_ssl": False,
    },
    "whatsapp": {
        "enabled": False,
        "connected": False,
        "connection_name": "Hipersales Alerts",
        "alert_phone": "",
        "instance_id": "",
        "qr_payload": "",
        "qr_token": "",
        "last_qr_at": None,
        "last_error": "",
        "connected_at": None,
        "provider": "evolution",
        "qr_image_url": "",
        "unavailable_reply_enabled": False,
        "unavailable_reply_message": (
            "Esse canal e exclusivo para status do HiperSales Web. "
            "Qualquer comunicacao deve ser feita pelo canal oficial. "
            "Sua mensagem nao sera vista por aqui."
        ),
    },
    "message_templates": {
        "email": {
            "order_status_changed": {
                "subject": "Status do pedido #{{pedido_id}} atualizado",
                "body": """<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef4fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#102035;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d9e3ef;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(13,47,107,0.08);">
      <tr>
        <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#08142b 0%,#0b3d8f 45%,#0d8c80 100%);text-align:center;">
          <div style="margin-bottom:14px;">{{logo_email}}</div>
          <div style="color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Atualização do pedido</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 18px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0d6fd8;font-weight:800;">Pedido #{{pedido_id}}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#0b2a63;">Status do pedido atualizado</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#617287;">Olá, {{cliente}}. Seu pedido foi movimentado no fluxo interno e agora segue com o status abaixo.</p>
          <div style="padding:18px 20px;border-radius:14px;background:#f5f9ff;border:1px solid #d9e3ef;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#617287;margin-bottom:10px;">Status atual</div>
            <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#e7f7ec;color:#0f9f8a;font-weight:800;">{{status_label}}</div>
            <div style="margin-top:14px;font-size:14px;line-height:1.7;color:#102035;white-space:pre-line;">{{observacoes}}</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;width:34%;font-size:13px;">Empresa</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{empresa}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Representante comercial</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{vendedor}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Ordem de compra</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{oc}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#617287;font-size:13px;">Total</td>
              <td style="padding:10px 0;font-weight:700;">{{total}}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e8eef6;font-size:12px;line-height:1.7;color:#617287;">
            Mensagem gerada automaticamente pelo sistema Hipersales.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>""",
            },
            "customer_approved": {
                "subject": "Cliente {{cliente}} aprovado",
                "body": """<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef4fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#102035;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d9e3ef;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(13,47,107,0.08);">
      <tr>
        <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#08142b 0%,#0b3d8f 45%,#0d8c80 100%);text-align:center;">
          <div style="margin-bottom:14px;">{{logo_email}}</div>
          <div style="color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Cliente aprovado</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 18px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0d6fd8;font-weight:800;">Solicitação #{{solicitacao_id}}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#0b2a63;">Cadastro liberado</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#617287;">O cliente <strong>{{cliente}}</strong> foi aprovado e já pode seguir para as próximas etapas comerciais.</p>
          <div style="padding:18px 20px;border-radius:14px;background:#f5f9ff;border:1px solid #d9e3ef;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#617287;margin-bottom:10px;">Situação</div>
            <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#e7f7ec;color:#0f9f8a;font-weight:800;">{{status_label}}</div>
            <div style="margin-top:14px;font-size:14px;line-height:1.7;color:#102035;white-space:pre-line;">{{observacoes}}</div>
            <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#eef9f4;color:#0b6f50;font-size:14px;line-height:1.6;font-weight:700;">{{apto_novos_pedidos}}</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;width:34%;font-size:13px;">Cliente</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{cliente}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">CNPJ</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{cnpj}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Representante comercial</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{vendedor}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#617287;font-size:13px;">E-mail do cliente</td>
              <td style="padding:10px 0;font-weight:700;">{{cliente_email}}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e8eef6;font-size:12px;line-height:1.7;color:#617287;">
            Mensagem gerada automaticamente pelo sistema Hipersales.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>""",
            },
        },
        "whatsapp": {
            "order_status_changed": {
                "subject": "Atualizacao do pedido #{{pedido_id}}",
                "body": "Olá, {{vendedor}} 😀\n\nEstamos fornecendo de forma automática uma informação diretamente do HiperSales Web.\nO pedido nº #{{pedido_id}} referente ao cliente {{cliente}} + {{cnpj}} teve uma atualização em seu status.\n\nSeu pedido encontra-se {{status_label}}\n\nVocê poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção \"consultar pedidos\" na tela inicial.\n\nEm breve volto com mais atualizações sobre seus pedidos!\nÓtimas vendas, até mais {{vendedor}}!",
            },
            "customer_approved": {
                "subject": "Cliente aprovado",
                "body": "Cliente {{cliente}} aprovado. Solicitacao #{{solicitacao_id}}.\nRepresentante comercial: {{vendedor}}\nCNPJ: {{cnpj}}\n{{observacoes}}\n{{apto_novos_pedidos}}",
            },
        },
    },
}

PLACEHOLDER_DEFINITIONS: list[dict[str, str]] = [
    {"token": "{{pedido_id}}", "label": "Pedido"},
    {"token": "{{solicitacao_id}}", "label": "Solicitacao"},
    {"token": "{{logo_email}}", "label": "Logo do e-mail"},
    {"token": "{{cliente}}", "label": "Cliente"},
    {"token": "{{cliente_email}}", "label": "E-mail do cliente"},
    {"token": "{{empresa}}", "label": "Empresa"},
    {"token": "{{vendedor}}", "label": "Representante comercial"},
    {"token": "{{vendedor_email}}", "label": "Usuario do representante comercial"},
    {"token": "{{cnpj}}", "label": "CNPJ"},
    {"token": "{{status}}", "label": "Status"},
    {"token": "{{status_label}}", "label": "Status legivel"},
    {"token": "{{total}}", "label": "Total"},
    {"token": "{{observacoes}}", "label": "Observacoes"},
    {"token": "{{oc}}", "label": "Ordem de compra"},
    {"token": "{{data}}", "label": "Data"},
    {"token": "{{apto_novos_pedidos}}", "label": "Aviso de base"},
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def session_cookie_header(value: str, max_age: int) -> str:
    attributes = [
        f"{SESSION_COOKIE}={value}",
        "Path=/",
        "HttpOnly",
        f"SameSite={SESSION_COOKIE_SAMESITE}",
        f"Max-Age={max_age}",
    ]
    if SESSION_COOKIE_SECURE:
        attributes.append("Secure")
    return "; ".join(attributes)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def inserted_id(cursor: Any) -> int:
    """Read the identifier of a newly inserted row.

    SQLite currently exposes lastrowid. PostgreSQL call sites must use
    INSERT ... RETURNING id; psycopg cursors do not expose lastrowid.
    """
    value = getattr(cursor, "lastrowid", None)
    if value is not None:
        return int(value)
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("INSERT ... RETURNING id did not return a row")
    if isinstance(row, dict):
        return int(row["id"])
    return int(row[0])


def dict_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 150_000)
    return base64.b64encode(salt + digest).decode("ascii")


def verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored.encode("ascii"))
        salt, digest = raw[:16], raw[16:]
        check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 150_000)
        return hmac.compare_digest(digest, check)
    except Exception:
        return False


def public_user_payload(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    role = "super_admin" if coerce_bool(data.get("is_super_admin", 0)) else data.get("role")
    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "email": data.get("email"),
        "communication_email": data.get("communication_email"),
        "whatsapp_phone": data.get("whatsapp_phone"),
        "role": role,
        "tenant_id": data.get("tenant_id"),
        "tenant_name": data.get("tenant_name"),
        "is_super_admin": role == "super_admin",
        "active": bool(data.get("active", 1)),
        "must_change_password": bool(data.get("must_change_password", 0)),
        "password_updated_at": data.get("password_updated_at"),
    }


def normalize_username(value: Any) -> str:
    username = str(value or "").strip().lower()
    if "@" in username:
        username = username.split("@", 1)[0]
    return username


def slugify(value: Any) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return slug or f"tenant-{secrets.token_hex(4)}"


def user_row_or_error(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise ApiError(HTTPStatus.NOT_FOUND, "Usuario nao encontrado.")
    return row


def init_db() -> None:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'active',
                owner_email TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                communication_email TEXT,
                whatsapp_phone TEXT,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'seller')),
                is_super_admin INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                must_change_password INTEGER NOT NULL DEFAULT 0,
                password_updated_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                legal_name TEXT,
                active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                legal_name TEXT NOT NULL,
                trade_name TEXT,
                cnpj TEXT NOT NULL UNIQUE,
                state_registration TEXT,
                address TEXT,
                phone TEXT,
                email TEXT,
                form_payload TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS customer_sellers (
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (customer_id, seller_id)
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT 'UN',
                price REAL NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                UNIQUE(company_id, code)
            );

            CREATE TABLE IF NOT EXISTS registration_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                order_number INTEGER UNIQUE,
                seller_id INTEGER NOT NULL REFERENCES users(id),
                legal_name TEXT NOT NULL,
                trade_name TEXT,
                cnpj TEXT NOT NULL,
                state_registration TEXT,
                address TEXT,
                phone TEXT,
                email TEXT,
                notes TEXT,
                form_payload TEXT,
                status TEXT NOT NULL DEFAULT 'pendente',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                seller_id INTEGER NOT NULL REFERENCES users(id),
                company_id INTEGER NOT NULL REFERENCES companies(id),
                customer_id INTEGER NOT NULL REFERENCES customers(id),
                order_type TEXT NOT NULL,
                purchase_order TEXT,
                commission_percent REAL NOT NULL DEFAULT 0,
                invoice_type TEXT NOT NULL,
                tax_operator_invoice INTEGER NOT NULL DEFAULT 0,
                freight_type TEXT NOT NULL,
                delivery_type TEXT NOT NULL,
                scheduled_delivery_date TEXT,
                discount_percent REAL NOT NULL DEFAULT 0,
                discount_on TEXT,
                payment_terms TEXT NOT NULL,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'em_analise',
                admin_notes TEXT,
                delivery_forecast TEXT,
                industry_order_number TEXT,
                invoice_number TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS proposal_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                quantity REAL NOT NULL,
                negotiated_price REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS email_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                recipients TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                sent_at TEXT,
                error TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS proposal_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                title TEXT NOT NULL,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS whatsapp_auto_replies (
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                instance_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                remote_jid TEXT NOT NULL,
                replied_at TEXT NOT NULL,
                PRIMARY KEY (tenant_id, instance_id, message_id)
            );

            CREATE TABLE IF NOT EXISTS occurrences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                description TEXT NOT NULL,
                attachment_names TEXT,
                status TEXT NOT NULL DEFAULT 'aberta',
                resolution TEXT,
                resolved_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS occurrence_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                content BLOB NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS occurrence_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
                tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                title TEXT NOT NULL,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tenant_settings (
                tenant_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (tenant_id, key),
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            """
        )
        migrate_db(conn)
        seed(conn)
        seed_settings(conn)


def seed(conn: sqlite3.Connection) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO tenants (id, name, slug, status, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (1, "HiperMix Representacoes", "hipermix", "active", "vendas@hipermixrepresentacoes.com.br", now_iso()),
    )
    ensure_super_admin(conn)
    if not env_bool("HYPERSALES_SEED_DEMO_DATA", False):
        return

    existing = conn.execute(
        "SELECT COUNT(*) AS total FROM users WHERE COALESCE(is_super_admin, 0) = 0"
    ).fetchone()["total"]
    if existing:
        return

    users = [
        (
            "Administrador Demo",
            env_text("HYPERSALES_DEMO_ADMIN_USERNAME", "admin-demo"),
            env_text("HYPERSALES_DEMO_ADMIN_PASSWORD"),
            "admin",
        ),
        (
            "Representante Comercial Demo",
            env_text("HYPERSALES_DEMO_SELLER_USERNAME", "vendedor-demo"),
            env_text("HYPERSALES_DEMO_SELLER_PASSWORD"),
            "seller",
        ),
    ]
    for name, username, password, role in users:
        validate_bootstrap_password(password, f"senha de demonstracao de {username}")
        conn.execute(
            """
            INSERT INTO users (tenant_id, name, email, password_hash, role, active, must_change_password, password_updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (1, name, normalize_username(username), hash_password(password), role, 1, 1, now_iso(), now_iso()),
        )

    seller_id = conn.execute("SELECT id FROM users WHERE role = 'seller'").fetchone()["id"]
    conn.execute("INSERT INTO companies (name, legal_name) VALUES (?, ?)", ("Industria Modelo", "Industria Modelo S/A"))
    company_id = conn.execute("SELECT id FROM companies WHERE name = ?", ("Industria Modelo",)).fetchone()["id"]
    conn.execute("INSERT INTO company_sellers (company_id, seller_id) VALUES (?, ?)", (company_id, seller_id))
    customers = [
        ("Mercado Central LTDA", "Mercado Central", "12.345.678/0001-90", "123456789", "Rua Brasil, 100", "(11) 3333-2222", "compras@mercadocentral.com.br"),
        ("Atacado Forte LTDA", "Atacado Forte", "98.765.432/0001-10", "987654321", "Av. Comercial, 250", "(11) 4444-3333", "pedido@atacadoforte.com.br"),
    ]
    for customer in customers:
        cur = conn.execute(
            """
            INSERT INTO customers
                (legal_name, trade_name, cnpj, state_registration, address, phone, email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*customer, now_iso()),
        )
        conn.execute("INSERT INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)", (inserted_id(cur), seller_id))

    products = [
        ("001", "Produto Alimento 1kg", "CX", 120.0),
        ("002", "Produto Limpeza 500ml", "CX", 86.5),
        ("003", "Produto Mercearia 250g", "FD", 54.0),
    ]
    for code, name, unit, price in products:
        conn.execute(
            "INSERT INTO products (company_id, code, name, unit, price) VALUES (?, ?, ?, ?, ?)",
            (company_id, code, name, unit, price),
        )


def seed_settings(conn: sqlite3.Connection) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        conn.execute(
            "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)",
            (key, json.dumps(value, ensure_ascii=False), now_iso()),
        )


def validate_bootstrap_password(password: str, label: str = "senha") -> None:
    if len(password) < 12:
        raise RuntimeError(f"A {label} deve possuir pelo menos 12 caracteres.")


def ensure_super_admin(conn: sqlite3.Connection) -> None:
    configured_name = env_text("HYPERSALES_SUPERADMIN_NAME")
    configured_username = normalize_username(env_text("HYPERSALES_SUPERADMIN_USERNAME"))
    configured_password = env_text("HYPERSALES_SUPERADMIN_PASSWORD")
    rotate_password = env_bool("HYPERSALES_SUPERADMIN_ROTATE_PASSWORD", False)
    must_change_password = env_bool("HYPERSALES_SUPERADMIN_MUST_CHANGE_PASSWORD", True)
    existing = conn.execute(
        "SELECT * FROM users WHERE COALESCE(is_super_admin, 0) = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    if existing:
        name = configured_name or existing["name"]
        username = configured_username or existing["email"]
        conn.execute(
            """
            UPDATE users
            SET name = ?, email = ?, role = 'admin', is_super_admin = 1, active = 1, tenant_id = NULL
            WHERE id = ?
            """,
            (name, username, existing["id"]),
        )
        if rotate_password:
            validate_bootstrap_password(configured_password, "senha do superadministrador")
            if not verify_password(configured_password, existing["password_hash"]):
                conn.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, must_change_password = ?, password_updated_at = ?
                    WHERE id = ?
                    """,
                    (hash_password(configured_password), int(must_change_password), now_iso(), existing["id"]),
                )
        return

    if not configured_name or not configured_username or not configured_password:
        raise RuntimeError(
            "Banco sem superadministrador. Configure HYPERSALES_SUPERADMIN_NAME, "
            "HYPERSALES_SUPERADMIN_USERNAME e HYPERSALES_SUPERADMIN_PASSWORD."
        )
    validate_bootstrap_password(configured_password, "senha do superadministrador")
    conn.execute(
        """
        INSERT INTO users (tenant_id, name, email, password_hash, role, is_super_admin, active, must_change_password, password_updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            None,
            configured_name,
            configured_username,
            hash_password(configured_password),
            "admin",
            1,
            1,
            int(must_change_password),
            now_iso(),
            now_iso(),
        ),
    )


def migrate_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'active',
            owner_email TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "INSERT OR IGNORE INTO tenants (id, name, slug, status, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (1, "HiperMix Representacoes", "hipermix", "active", "vendas@hipermixrepresentacoes.com.br", now_iso()),
    )
    company_sellers_exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'company_sellers'"
    ).fetchone()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS company_sellers (
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (company_id, seller_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seller_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
            seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            sales_goal REAL,
            new_customers_goal INTEGER,
            customer_positivation_goal REAL,
            updated_at TEXT NOT NULL,
            UNIQUE (tenant_id, seller_id, year, month)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seller_goal_reminders (
            tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
            seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            sent_at TEXT NOT NULL,
            PRIMARY KEY (tenant_id, seller_id, year, month, day)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS occurrences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
            seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            description TEXT NOT NULL,
            attachment_names TEXT,
            status TEXT NOT NULL DEFAULT 'aberta',
            resolution TEXT,
            resolved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS occurrence_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
            tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            mimetype TEXT NOT NULL,
            content BLOB NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS occurrence_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
            tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            title TEXT NOT NULL,
            notes TEXT,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        )
        """
    )
    occurrence_columns = {row["name"] for row in conn.execute("PRAGMA table_info(occurrences)").fetchall()}
    if "resolved_at" not in occurrence_columns:
        conn.execute("ALTER TABLE occurrences ADD COLUMN resolved_at TEXT")
    if not company_sellers_exists:
        conn.execute(
            """
            INSERT OR IGNORE INTO company_sellers (company_id, seller_id)
            SELECT c.id, u.id
            FROM companies c
            JOIN users u ON u.tenant_id = c.tenant_id AND u.role = 'seller'
            """
        )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tenant_settings (
            tenant_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (tenant_id, key),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
        """
    )
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(users)").fetchall()
    }
    if "tenant_id" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN tenant_id INTEGER")
    if "is_super_admin" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0")
    if "must_change_password" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0")
    if "password_updated_at" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN password_updated_at TEXT")
    if "communication_email" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN communication_email TEXT")
    if "whatsapp_phone" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN whatsapp_phone TEXT")
    for row in conn.execute("SELECT id, whatsapp_phone FROM users WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone <> ''").fetchall():
        normalized_phone = normalize_whatsapp_phone(row["whatsapp_phone"])
        if normalized_phone != row["whatsapp_phone"]:
            conn.execute("UPDATE users SET whatsapp_phone = ? WHERE id = ?", (normalized_phone, row["id"]))
    conn.execute(
        """
        UPDATE users
        SET password_updated_at = COALESCE(password_updated_at, created_at),
            tenant_id = CASE WHEN COALESCE(is_super_admin, 0) = 1 THEN NULL ELSE COALESCE(tenant_id, 1) END
        """
    )
    ensure_super_admin(conn)

    for table in ["companies", "customers", "products", "registration_requests", "proposals", "email_outbox"]:
        table_columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if "tenant_id" not in table_columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1")
        conn.execute(f"UPDATE {table} SET tenant_id = COALESCE(tenant_id, 1)")
    for row in conn.execute("SELECT id, email FROM users").fetchall():
        username = normalize_username(row["email"])
        if username and username != row["email"]:
            exists = conn.execute(
                "SELECT id FROM users WHERE email = ? AND id <> ?",
                (username, row["id"]),
            ).fetchone()
            if exists:
                username = f"{username}_{row['id']}"
            conn.execute("UPDATE users SET email = ? WHERE id = ?", (username, row["id"]))

    customer_columns = {row["name"] for row in conn.execute("PRAGMA table_info(customers)").fetchall()}
    if "form_payload" not in customer_columns:
        conn.execute("ALTER TABLE customers ADD COLUMN form_payload TEXT")
    for row in conn.execute("SELECT id, state_registration, address, phone, email, form_payload FROM customers WHERE form_payload IS NOT NULL AND form_payload <> ''").fetchall():
        enriched = enrich_customer_payload(dict(row))
        if (
            first_text(row["state_registration"]) != first_text(enriched.get("state_registration")) or
            first_text(row["address"]) != first_text(enriched.get("address")) or
            first_text(row["phone"]) != first_text(enriched.get("phone")) or
            first_text(row["email"]) != first_text(enriched.get("email"))
        ):
            conn.execute(
                """
                UPDATE customers
                SET state_registration = ?, address = ?, phone = ?, email = ?
                WHERE id = ?
                """,
                (
                    enriched.get("state_registration"),
                    enriched.get("address"),
                    enriched.get("phone"),
                    enriched.get("email"),
                    row["id"],
                ),
            )

    request_columns = {row["name"] for row in conn.execute("PRAGMA table_info(registration_requests)").fetchall()}
    if "form_payload" not in request_columns:
        conn.execute("ALTER TABLE registration_requests ADD COLUMN form_payload TEXT")

    outbox_columns = {row["name"] for row in conn.execute("PRAGMA table_info(email_outbox)").fetchall()}
    if "attempts" not in outbox_columns:
        conn.execute("ALTER TABLE email_outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0")
    if "sent_at" not in outbox_columns:
        conn.execute("ALTER TABLE email_outbox ADD COLUMN sent_at TEXT")
    if "error" not in outbox_columns:
        conn.execute("ALTER TABLE email_outbox ADD COLUMN error TEXT")

    proposal_columns = {row["name"] for row in conn.execute("PRAGMA table_info(proposals)").fetchall()}
    if "order_number" not in proposal_columns:
        conn.execute("ALTER TABLE proposals ADD COLUMN order_number INTEGER")
    next_number = int(conn.execute("SELECT COALESCE(MAX(order_number), 10839) + 1 AS next_number FROM proposals").fetchone()["next_number"])
    for row in conn.execute("SELECT id FROM proposals WHERE order_number IS NULL ORDER BY id").fetchall():
        conn.execute("UPDATE proposals SET order_number = ? WHERE id = ?", (next_number, row["id"]))
        next_number += 1
    if "delivery_forecast" not in proposal_columns:
        conn.execute("ALTER TABLE proposals ADD COLUMN delivery_forecast TEXT")
    if "industry_order_number" not in proposal_columns:
        conn.execute("ALTER TABLE proposals ADD COLUMN industry_order_number TEXT")
    if "invoice_number" not in proposal_columns:
        conn.execute("ALTER TABLE proposals ADD COLUMN invoice_number TEXT")
    if "tax_operator_invoice" not in proposal_columns:
        conn.execute("ALTER TABLE proposals ADD COLUMN tax_operator_invoice INTEGER NOT NULL DEFAULT 0")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS proposal_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            title TEXT NOT NULL,
            notes TEXT,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("UPDATE proposals SET status = 'em_analise' WHERE status = 'proposta_enviada'")
    conn.execute("UPDATE proposals SET status = 'recusado' WHERE status = 'proposta_recusada'")
    existing_events = conn.execute("SELECT COUNT(*) AS total FROM proposal_events").fetchone()["total"]
    if not existing_events:
        for proposal in conn.execute("SELECT id, seller_id, status, created_at, updated_at FROM proposals").fetchall():
            created_at = proposal["created_at"] or now_iso()
            conn.execute(
                """
                INSERT INTO proposal_events (proposal_id, status, title, notes, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    proposal["id"],
                    "em_analise",
                    STATUS_LABELS["em_analise"],
                    "Proposta enviada para analise.",
                    proposal["seller_id"],
                    created_at,
                ),
            )
            if proposal["status"] != "em_analise":
                conn.execute(
                    """
                    INSERT INTO proposal_events (proposal_id, status, title, notes, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        proposal["id"],
                        proposal["status"],
                        STATUS_LABELS.get(proposal["status"], proposal["status"]),
                        "",
                        None,
                        proposal["updated_at"] or created_at,
                    ),
                )


def cleanup_sessions(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (int(datetime.now().timestamp()),))


def read_setting(conn: sqlite3.Connection, key: str, fallback: Any) -> Any:
    tenant_id = current_tenant_id(conn)
    row = None
    if tenant_id and TENANT_CONTEXT.get(id(conn)):
        row = conn.execute("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = ?", (tenant_id, key)).fetchone()
    if not row:
        row = conn.execute("SELECT value FROM system_settings WHERE key = ?", (key,)).fetchone()
    if not row:
        return fallback
    try:
        return json.loads(row["value"])
    except json.JSONDecodeError:
        return fallback


def write_setting(conn: sqlite3.Connection, key: str, value: Any) -> None:
    tenant_id = current_tenant_id(conn)
    if tenant_id and TENANT_CONTEXT.get(id(conn)):
        conn.execute(
            """
            INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (tenant_id, key, json.dumps(value, ensure_ascii=False), now_iso()),
        )
        return
    conn.execute(
        """
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """,
        (key, json.dumps(value, ensure_ascii=False), now_iso()),
    )


def current_tenant_id(conn: sqlite3.Connection) -> int:
    context = TENANT_CONTEXT.get(id(conn)) or {}
    return int(context.get("tenant_id") or 1)


def normalize_order_statuses(value: Any) -> list[dict[str, str]]:
    configured = value if isinstance(value, list) else []
    by_key = {str(item.get("key", "")): item for item in configured if isinstance(item, dict)}
    fallback = {item["key"]: item for item in DEFAULT_SETTINGS["order_statuses"]}
    normalized: list[dict[str, str]] = []
    for key, label in STATUS_LABELS.items():
        current = by_key.get(key, {})
        default = fallback.get(key, {"color": "#0d6fd8"})
        normalized.append({
            "key": key,
            "name": label,
            "color": sanitize_hex_color(current.get("color") or default.get("color") or "#0d6fd8"),
        })
    return normalized


def sanitize_hex_color(value: Any) -> str:
    color = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        return color.upper()
    return "#0D6FD8"


def queue_outbox(conn: sqlite3.Connection, kind: str, recipients: str, subject: str, body: str) -> None:
    cur = conn.execute(
        "INSERT INTO email_outbox (tenant_id, kind, recipients, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (current_tenant_id(conn), kind, recipients, subject, body, now_iso()),
    )
    if recipients.startswith("whatsapp:"):
        sent, error = send_evolution_whatsapp(conn, recipients.replace("whatsapp:", "", 1), body)
        if sent:
            conn.execute("UPDATE email_outbox SET sent_at = ?, error = NULL WHERE id = ?", (now_iso(), inserted_id(cur)))
        else:
            conn.execute(
                "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
                (error, inserted_id(cur)),
            )
        return
    smtp = normalize_smtp_settings(read_setting(conn, "smtp", DEFAULT_SETTINGS["smtp"]))
    if not smtp["host"] or not smtp["from_email"]:
        return
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{smtp['from_name']} <{smtp['from_email']}>" if smtp["from_name"] else smtp["from_email"]
    message["To"] = recipients
    message.set_content(body)
    context = ssl.create_default_context()
    client = None
    try:
        if smtp["use_ssl"]:
            client = smtplib.SMTP_SSL(smtp["host"], smtp["port"], timeout=10, context=context)
        else:
            client = smtplib.SMTP(smtp["host"], smtp["port"], timeout=10)
            client.ehlo()
            if smtp["use_tls"]:
                client.starttls(context=context)
                client.ehlo()
        if smtp["username"]:
            client.login(smtp["username"], smtp["password"])
        client.send_message(message)
        conn.execute("UPDATE email_outbox SET sent_at = ?, error = NULL WHERE id = ?", (now_iso(), inserted_id(cur)))
    except Exception as exc:
        conn.execute(
            "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
            (str(exc), inserted_id(cur)),
        )
        print(f"Falha ao enviar mensagem SMTP: {exc}")
    finally:
        try:
            if client:
                client.quit()
        except Exception:
            pass


def send_email_message(
    conn: sqlite3.Connection,
    kind: str,
    recipients: str,
    subject: str,
    body: str,
    attachments: list[dict[str, Any]] | None = None,
) -> None:
    cur = conn.execute(
        "INSERT INTO email_outbox (tenant_id, kind, recipients, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (current_tenant_id(conn), kind, recipients, subject, body, now_iso()),
    )
    if recipients.startswith("whatsapp:"):
        sent, error = send_evolution_whatsapp(conn, recipients.replace("whatsapp:", "", 1), body)
        if sent:
            conn.execute("UPDATE email_outbox SET sent_at = ?, error = NULL WHERE id = ?", (now_iso(), inserted_id(cur)))
        else:
            conn.execute(
                "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
                (error, inserted_id(cur)),
            )
        return
    smtp = normalize_smtp_settings(read_setting(conn, "smtp", DEFAULT_SETTINGS["smtp"]))
    if not smtp["host"] or not smtp["from_email"]:
        return
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{smtp['from_name']} <{smtp['from_email']}>" if smtp["from_name"] else smtp["from_email"]
    message["To"] = recipients
    message.set_content(body)
    for attachment in attachments or []:
        content = attachment.get("content") or b""
        filename = str(attachment.get("filename") or "anexo.bin")
        mimetype = str(attachment.get("mimetype") or "application/octet-stream")
        maintype, _, subtype = mimetype.partition("/")
        message.add_attachment(
            content,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=filename,
        )
    context = ssl.create_default_context()
    client = None
    try:
        if smtp["use_ssl"]:
            client = smtplib.SMTP_SSL(smtp["host"], smtp["port"], timeout=10, context=context)
        else:
            client = smtplib.SMTP(smtp["host"], smtp["port"], timeout=10)
            client.ehlo()
            if smtp["use_tls"]:
                client.starttls(context=context)
                client.ehlo()
        if smtp["username"]:
            client.login(smtp["username"], smtp["password"])
        client.send_message(message)
        conn.execute("UPDATE email_outbox SET sent_at = ?, error = NULL WHERE id = ?", (now_iso(), inserted_id(cur)))
    except Exception as exc:
        conn.execute(
            "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
            (str(exc), inserted_id(cur)),
        )
        print(f"Falha ao enviar mensagem SMTP: {exc}")
    finally:
        try:
            if client:
                client.quit()
        except Exception:
            pass


def whatsapp_internal_token() -> str:
    return env_text("HYPERSALES_WHATSAPP_TOKEN")


def normalize_whatsapp_phone(value: str) -> str:
    digits = re.sub(r"\D+", "", str(value or ""))
    if not digits:
        return ""
    if not digits.startswith("55") and 10 <= len(digits) <= 11:
        digits = f"55{digits}"
    return digits


def normalize_user_whatsapp_phone(value: Any) -> str:
    phone = normalize_whatsapp_phone(str(value or ""))
    if phone and len(phone) < 12:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Informe o WhatsApp com DDD. Exemplo: 5532999141230.")
    return phone


def evolution_api_key() -> str:
    env_key = env_text("EVOLUTION_API_KEY")
    if env_key:
        return env_key
    try:
        return EVOLUTION_API_KEY_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def evolution_instance_name(conn: sqlite3.Connection) -> str:
    return f"hipersales-tenant-{current_tenant_id(conn)}"


def tenant_id_from_evolution_instance(instance_name: str) -> int:
    match = re.search(r"hipersales-tenant-(\d+)", str(instance_name or ""))
    return int(match.group(1)) if match else 1


def evolution_request(method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    api_key = evolution_api_key()
    if not api_key:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "Evolution API sem chave configurada.")
    url = f"{EVOLUTION_API_URL}{path}"
    body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method.upper(),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "apikey": api_key,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else str(exc)
        if exc.code == 404:
            return {"error": True, "status": 404, "message": detail or "Nao encontrado"}
        raise ApiError(HTTPStatus.BAD_GATEWAY, f"Falha Evolution API: {detail or exc}") from exc
    except Exception as exc:
        raise ApiError(HTTPStatus.BAD_GATEWAY, f"Falha Evolution API: {exc}") from exc


def evolution_try_request(method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    try:
        return evolution_request(method, path, payload, timeout)
    except ApiError as exc:
        return {"error": True, "message": exc.message}


def send_evolution_whatsapp(conn: sqlite3.Connection, phone: str, text: str) -> tuple[bool, str]:
    settings = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
    if not settings.get("enabled"):
        return False, "WhatsApp nao habilitado."
    instance_name = settings.get("instance_id") or evolution_instance_name(conn)
    target = str(phone or "").strip()
    number = target if "@" in target else normalize_whatsapp_phone(target)
    if not number:
        return False, "Numero de WhatsApp invalido."
    result = evolution_try_request(
        "POST",
        f"/message/sendText/{quote_plus(instance_name)}",
        {"number": number, "text": text},
        timeout=20,
    )
    if result.get("error"):
        return False, str(result.get("message") or "Falha ao enviar WhatsApp.")
    return True, ""


def configure_evolution_webhook(conn: sqlite3.Connection, instance_name: str) -> dict[str, Any]:
    token = whatsapp_internal_token()
    webhook_url = f"{PUBLIC_APP_URL}/api/evolution/webhook?token={quote_plus(token)}"
    return evolution_try_request(
        "POST",
        f"/webhook/set/{quote_plus(instance_name)}",
        {
            "webhook": {
                "enabled": True,
                "url": webhook_url,
                "webhook_by_events": False,
                "webhook_base64": False,
                "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
            },
        },
        timeout=15,
    )


def coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on", "sim"}


def coerce_int(value: Any, fallback: int) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return fallback


def nullable_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip()
    if not raw:
        return None
    compact = raw.replace("R$", "").replace("%", "").replace(" ", "")
    if "," in compact and "." in compact:
        compact = compact.replace(".", "").replace(",", ".")
    elif "," in compact:
        compact = compact.replace(",", ".")
    try:
        return float(compact)
    except ValueError as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Valor de meta invalido.") from exc


def nullable_int(value: Any) -> int | None:
    parsed = nullable_float(value)
    if parsed is None:
        return None
    return max(0, int(parsed))


def safe_json_loads(value: Any, fallback: Any) -> Any:
    if value in (None, ""):
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except Exception:
        return fallback


def first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def payload_value(payload: dict[str, Any], *keys: str) -> str:
    row = payload.get("row") if isinstance(payload.get("row"), dict) else {}
    for key in keys:
        value = first_text(payload.get(key), row.get(key))
        if value:
            return value
    return ""


def build_customer_address_from_payload(payload: dict[str, Any]) -> str:
    direct = payload_value(payload, "address", "delivery_address")
    street = payload_value(payload, "street", "logradouro")
    number = payload_value(payload, "number", "numero")
    complement = payload_value(payload, "complement", "complemento")
    neighborhood = payload_value(payload, "neighborhood", "bairro_distrito", "bairro")
    city = payload_value(payload, "city", "cidade")
    state = payload_value(payload, "state", "uf")
    zip_code = payload_value(payload, "zip_code", "cep")
    if direct and not any([street, number, complement, neighborhood, city, state, zip_code]):
        return direct
    address_parts = [part for part in [direct or street, number, complement] if part]
    district = f" - {neighborhood}" if neighborhood else ""
    city_state = "/".join(part for part in [city, state] if part)
    return ", ".join(part for part in [" ".join(address_parts) + district if address_parts else "", city_state, f"CEP {zip_code}" if zip_code else ""] if part)


def enrich_customer_payload(customer: dict[str, Any]) -> dict[str, Any]:
    payload = safe_json_loads(customer.get("form_payload"), {})
    if not isinstance(payload, dict):
        payload = {}
    enriched = dict(customer)
    enriched["form_payload"] = payload
    enriched["state_registration"] = first_text(
        enriched.get("state_registration"),
        payload_value(payload, "state_registration", "insc_estadual", "inscricao_estadual"),
    )
    enriched["address"] = first_text(enriched.get("address"), build_customer_address_from_payload(payload))
    enriched["phone"] = first_text(
        enriched.get("phone"),
        payload_value(payload, "phone", "buyer_phone_1", "finance_phone_1", "logistics_phone_1", "representative_phone"),
    )
    enriched["email"] = first_text(
        enriched.get("email"),
        payload_value(payload, "email", "buyer_email", "billing_email", "xml_email", "representative_email"),
    )
    return enriched


def normalize_cnpj_digits(value: Any) -> str:
    return re.sub(r"\D+", "", str(value or ""))[:14]


def normalize_color(value: Any) -> str:
    color = str(value or "").strip().upper()
    if not re.fullmatch(r"#[0-9A-F]{6}", color):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Cor invalida. Use o formato #RRGGBB.")
    return color


def normalize_stage_list(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Etapas invalidas.")
    stages: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        color = str(item.get("color", "")).strip() or "#0D6FD8"
        if not name:
            continue
        stages.append({"name": name, "color": normalize_color(color)})
    if not stages:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Inclua ao menos uma etapa valida.")
    return stages


def normalize_smtp_settings(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Configuracao SMTP invalida.")
    host = str(value.get("host", "")).strip()
    port = coerce_int(value.get("port", 587), 587)
    username = str(value.get("username", "")).strip()
    password = str(value.get("password", ""))
    from_name = str(value.get("from_name", "Hipersales")).strip() or "Hipersales"
    from_email = str(value.get("from_email", "")).strip()
    if port < 1 or port > 65535:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Porta SMTP invalida.")
    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "from_name": from_name,
        "from_email": from_email,
        "use_tls": coerce_bool(value.get("use_tls", True)),
        "use_ssl": coerce_bool(value.get("use_ssl", False)),
    }


def normalize_whatsapp_settings(value: Any, current: dict[str, Any] | None = None) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Configuracao WhatsApp invalida.")
    current = current or {}
    connection_name = str(value.get("connection_name", current.get("connection_name", "Hipersales Alerts"))).strip() or "Hipersales Alerts"
    alert_phone = str(value.get("alert_phone", current.get("alert_phone", ""))).strip()
    instance_id = str(value.get("instance_id", current.get("instance_id", ""))).strip()
    default_unavailable_message = DEFAULT_SETTINGS["whatsapp"]["unavailable_reply_message"]
    unavailable_reply_message = str(
        value.get(
            "unavailable_reply_message",
            current.get("unavailable_reply_message", default_unavailable_message),
        )
        or default_unavailable_message
    ).strip()
    return {
        "enabled": coerce_bool(value.get("enabled", current.get("enabled", False))),
        "connected": coerce_bool(value.get("connected", current.get("connected", False))),
        "connection_name": connection_name,
        "alert_phone": alert_phone,
        "instance_id": instance_id,
        "qr_payload": str(value.get("qr_payload", current.get("qr_payload", ""))).strip(),
        "qr_token": str(value.get("qr_token", current.get("qr_token", ""))).strip(),
        "last_qr_at": value.get("last_qr_at", current.get("last_qr_at")),
        "last_error": str(value.get("last_error", current.get("last_error", ""))).strip(),
        "connected_at": value.get("connected_at", current.get("connected_at")),
        "provider": str(value.get("provider", current.get("provider", "evolution")) or "evolution").strip(),
        "qr_image_url": str(value.get("qr_image_url", current.get("qr_image_url", ""))).strip(),
        "unavailable_reply_enabled": coerce_bool(
            value.get("unavailable_reply_enabled", current.get("unavailable_reply_enabled", False))
        ),
        "unavailable_reply_message": unavailable_reply_message,
    }


def looks_like_html(value: str) -> bool:
    text = value.lstrip().lower()
    return text.startswith("<!doctype") or text.startswith("<html") or "<table" in text or "<body" in text


def email_logo_markup() -> str:
    logo_path = FRONTEND_DIR / "assets" / "logoweb.png"
    if not logo_path.exists():
        logo_path = FRONTEND_DIR / "assets" / "logoapp.png"
    try:
        payload = base64.b64encode(logo_path.read_bytes()).decode("ascii")
    except OSError:
        return (
            '<div style="display:inline-block;padding:10px 16px;border-radius:999px;'
            'background:rgba(255,255,255,0.16);color:#fff;font-weight:800;letter-spacing:.08em;'
            'text-transform:uppercase;">Hipersales</div>'
        )
    return (
        '<img src="data:image/png;base64,'
        f'{payload}" alt="Hipersales" '
        'style="width:190px;max-width:100%;height:auto;display:block;margin:0 auto;" />'
    )


def normalize_templates_settings(value: Any, current: Any | None = None) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Modelos de mensagem invalidos.")

    def normalize_entry(template_value: Any, fallback: dict[str, str], html_only: bool = False) -> dict[str, str]:
        subject = str(fallback.get("subject", "")).strip()
        body = str(fallback.get("body", "")).strip()
        if isinstance(template_value, str):
            body = template_value.strip()
        elif isinstance(template_value, dict):
            subject = str(template_value.get("subject", subject)).strip() or subject
            body = str(template_value.get("body", body)).strip()
        elif template_value not in (None, {}):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Modelo de mensagem invalido.")
        if not body:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Preencha o corpo do modelo de mensagem.")
        if html_only and not looks_like_html(body):
            body = str(fallback.get("body", "")).strip()
        if not subject:
            subject = fallback.get("subject", "")
        return {"subject": subject, "body": body}

    defaults = DEFAULT_SETTINGS["message_templates"]
    current = current if isinstance(current, dict) else {}
    current_email = current.get("email") if isinstance(current.get("email"), dict) else {}
    current_whatsapp = current.get("whatsapp") if isinstance(current.get("whatsapp"), dict) else {}
    legacy_current = {
        "order_status_changed": current.get("order_status", current.get("order_status_changed", {})),
        "customer_approved": current.get("order_approved", current.get("customer_approved", {})),
    }
    email_raw = value.get("email")
    whatsapp_raw = value.get("whatsapp")

    if email_raw is None and whatsapp_raw is None:
        legacy_order_status = value.get("order_status", value.get("order_status_changed", {}))
        legacy_customer_approved = value.get("order_approved", value.get("customer_approved", {}))
        email_raw = {
            "order_status_changed": legacy_order_status,
            "customer_approved": legacy_customer_approved,
        }
        whatsapp_raw = {
            "order_status_changed": legacy_order_status,
            "customer_approved": legacy_customer_approved,
        }

    if email_raw is None:
        email_raw = current_email or legacy_current or defaults["email"]
    if whatsapp_raw is None:
        whatsapp_raw = current_whatsapp or legacy_current or defaults["whatsapp"]

    if not isinstance(email_raw, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Modelo de e-mail invalido.")
    if not isinstance(whatsapp_raw, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Modelo de WhatsApp invalido.")

    return {
        "email": {
            "order_status_changed": normalize_entry(
                email_raw.get("order_status_changed", email_raw.get("order_status", {})),
                defaults["email"]["order_status_changed"],
                html_only=True,
            ),
            "customer_approved": normalize_entry(
                email_raw.get("customer_approved", email_raw.get("order_approved", {})),
                defaults["email"]["customer_approved"],
                html_only=True,
            ),
        },
        "whatsapp": {
            "order_status_changed": normalize_entry(
                whatsapp_raw.get("order_status_changed", whatsapp_raw.get("order_status", {})),
                defaults["whatsapp"]["order_status_changed"],
            ),
            "customer_approved": normalize_entry(
                whatsapp_raw.get("customer_approved", whatsapp_raw.get("order_approved", {})),
                defaults["whatsapp"]["customer_approved"],
            ),
        },
    }


def template_context(conn: sqlite3.Connection, proposal_id: int, status: str) -> dict[str, str]:
    row = conn.execute(
        """
        SELECT p.id, p.order_number, p.notes, p.purchase_order, p.admin_notes, p.status, p.updated_at,
               p.delivery_forecast, p.industry_order_number, p.invoice_number,
               u.name AS seller_name, u.email AS seller_email,
               COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_contact_email,
               u.whatsapp_phone AS seller_whatsapp_phone,
               c.legal_name AS customer_name, c.trade_name AS customer_trade_name, c.cnpj, c.email AS customer_email,
               co.name AS company_name
        FROM proposals p
        JOIN users u ON u.id = p.seller_id
        JOIN customers c ON c.id = p.customer_id
        JOIN companies co ON co.id = p.company_id
        WHERE p.id = ?
        """,
        (proposal_id,),
    ).fetchone()
    if not row:
        raise ApiError(HTTPStatus.NOT_FOUND, "Proposta nao encontrada.")
    items = conn.execute(
        "SELECT quantity, negotiated_price FROM proposal_items WHERE proposal_id = ?",
        (proposal_id,),
    ).fetchall()
    total = sum(float(item["quantity"]) * float(item["negotiated_price"]) for item in items)
    customer = row["customer_trade_name"] or row["customer_name"]
    observations = " | ".join(part for part in [row["notes"], row["admin_notes"]] if part)
    return {
        "pedido_id": str(row["order_number"] or row["id"]),
        "logo_email": email_logo_markup(),
        "cliente": customer,
        "cliente_email": row["customer_email"] or "",
        "empresa": row["company_name"],
        "vendedor": row["seller_name"],
        "vendedor_email": row["seller_contact_email"] or row["seller_email"],
        "vendedor_whatsapp": row["seller_whatsapp_phone"] or "",
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "total": format_brl(total),
        "observacoes": observations,
        "oc": row["purchase_order"] or "",
        "delivery_forecast": row["delivery_forecast"] or "",
        "industry_order_number": row["industry_order_number"] or "",
        "invoice_number": row["invoice_number"] or "",
        "data": row["updated_at"] or now_iso(),
        "cnpj": row["cnpj"],
    }


REQUEST_STATUS_LABELS = {
    "pendente": "Pendente",
    "aprovada": "Aprovada",
    "recusada": "Recusada",
}


def customer_request_context(conn: sqlite3.Connection, request_id: int, status: str) -> dict[str, str]:
    row = conn.execute(
        """
        SELECT rr.*, u.name AS seller_name, u.email AS seller_email,
               COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_contact_email,
               u.whatsapp_phone AS seller_whatsapp_phone
        FROM registration_requests rr
        JOIN users u ON u.id = rr.seller_id
        WHERE rr.id = ?
        """,
        (request_id,),
    ).fetchone()
    if not row:
        raise ApiError(HTTPStatus.NOT_FOUND, "Solicitacao nao encontrada.")
    customer_name = row["trade_name"] or row["legal_name"]
    return {
        "solicitacao_id": str(row["id"]),
        "logo_email": email_logo_markup(),
        "cliente": customer_name,
        "cliente_email": row["email"] or "",
        "empresa": "",
        "vendedor": row["seller_name"],
        "vendedor_email": row["seller_contact_email"] or row["seller_email"],
        "vendedor_whatsapp": row["seller_whatsapp_phone"] or "",
        "cnpj": row["cnpj"],
        "status": status,
        "status_label": REQUEST_STATUS_LABELS.get(status, status),
        "observacoes": row["notes"] or "",
        "apto_novos_pedidos": "O cliente esta apto para emitir novos pedidos, pois esta vinculado a base.",
        "data": now_iso(),
    }


def render_template(template: str, context: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        return str(context.get(match.group(1), ""))

    return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace, template)


def append_html_notice(body: str, notice: str) -> str:
    snippet = (
        "<div style=\"margin-top:16px;padding:12px 14px;border-radius:12px;"
        "background:#eef9f4;color:#0b6f50;font-size:14px;line-height:1.6;font-weight:700;\">"
        f"{notice}"
        "</div>"
    )
    if notice and notice in body:
        return body
    if "</body>" in body:
        return body.replace("</body>", f"{snippet}</body>", 1)
    return f"{body}\n\n{notice}" if notice else body


def format_brl(value: float) -> str:
    number = f"{float(value):,.2f}"
    number = number.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {number}"


def normalize_discount_on(value: Any) -> str:
    raw = str(value or "").strip()
    mapping = {
        "Desconto no boleto": "Boleto Bancario",
        "Desconto na nota fiscal": "Nota Fiscal",
        "Boleto Bancário": "Boleto Bancario",
        "Boleto Bancario": "Boleto Bancario",
        "Nota Fiscal": "Nota Fiscal",
        "Sem descontos": "Sem descontos",
    }
    if not raw:
        return "Sem descontos"
    return mapping.get(raw, raw)


def parse_percentage_value(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip()
    if not raw:
        return 0.0
    compact = raw.replace("%", "").replace(" ", "")
    if "," in compact and "." in compact:
        cleaned = compact.replace(".", "").replace(",", ".")
    elif "," in compact:
        cleaned = compact.replace(",", ".")
    else:
        cleaned = compact
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def timeline_actor_label(status: Any, created_by_name: Any = "") -> str:
    label = str(status or "")
    mapping = {
        "em_analise": str(created_by_name or "Representante comercial"),
        "pedido_aprovado": "FPP",
        "recusado": "FPP",
        "em_producao": "PCP",
        "faturado": "FPP",
        "entregue": "Logistica & Transporte",
    }
    return mapping.get(label, str(created_by_name or "HiperSales Web"))


STATUS_LABELS = {
    "em_analise": "Em analise",
    "pedido_aprovado": "Pedido aprovado",
    "recusado": "Proposta recusada",
    "em_producao": "Em producao",
    "faturado": "Faturado",
    "entregue": "Pedido entregue",
}

ORDER_STATUS_RANK = {
    "em_analise": 0,
    "pedido_aprovado": 1,
    "recusado": 1,
    "em_producao": 2,
    "faturado": 3,
    "entregue": 4,
}


def normalize_timeline_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean_events: list[dict[str, Any]] = []
    seen_statuses: set[str] = set()
    highest_rank = -1
    for event in events:
        status = str(event.get("status") or "")
        rank = ORDER_STATUS_RANK.get(status)
        if status in seen_statuses:
            continue
        if rank is not None and rank < highest_rank:
            continue
        if rank is not None:
            highest_rank = max(highest_rank, rank)
        seen_statuses.add(status)
        clean_events.append(event)
    return clean_events


def whatsapp_qr_payload(settings: dict[str, Any]) -> str:
    token = settings.get("qr_token") or secrets.token_urlsafe(24)
    name = settings.get("connection_name", "Hipersales Alerts")
    instance_id = settings.get("instance_id", "")
    return f"HYPERSALES-WHATSAPP|{name}|{instance_id}|{token}"


def whatsapp_qr_image_url(payload: str) -> str:
    return f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={quote_plus(payload)}"


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message
