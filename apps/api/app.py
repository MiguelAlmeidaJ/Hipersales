from __future__ import annotations

"""Ponto de entrada e composição do backend HiperSales."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *
try:
    from .http_handler import HttpHandlerMixin
except ImportError:  # Execução direta: python backend/app.py
    from http_handler import HttpHandlerMixin
try:
    from .tenant_goals import TenantGoalsMixin
except ImportError:  # Execução direta: python backend/app.py
    from tenant_goals import TenantGoalsMixin
try:
    from .sales import SalesMixin
except ImportError:  # Execução direta: python backend/app.py
    from sales import SalesMixin
try:
    from .admin_dashboard import AdminDashboardMixin
except ImportError:  # Execução direta: python backend/app.py
    from admin_dashboard import AdminDashboardMixin
try:
    from .catalog_admin import CatalogAdminMixin
except ImportError:  # Execução direta: python backend/app.py
    from catalog_admin import CatalogAdminMixin
try:
    from .order_admin import OrderAdminMixin
except ImportError:  # Execução direta: python backend/app.py
    from order_admin import OrderAdminMixin
try:
    from .report_data import ReportDataMixin
except ImportError:  # Execução direta: python backend/app.py
    from report_data import ReportDataMixin
try:
    from .report_pdf import ReportPdfMixin
except ImportError:  # Execução direta: python backend/app.py
    from report_pdf import ReportPdfMixin
try:
    from .background_jobs import BackgroundJobsMixin
except ImportError:  # Execução direta: python backend/app.py
    from background_jobs import BackgroundJobsMixin


class HypersalesHandler(
    HttpHandlerMixin,
    TenantGoalsMixin,
    SalesMixin,
    AdminDashboardMixin,
    CatalogAdminMixin,
    OrderAdminMixin,
    ReportDataMixin,
    ReportPdfMixin,
    BackgroundJobsMixin,
    SimpleHTTPRequestHandler,
):
    """Handler composto pelos módulos de domínio, preservando a API original."""

    pass


def weekly_report_scheduler() -> None:
    while True:
        try:
            with connect() as conn:
                handler = object.__new__(HypersalesHandler)
                try:
                    handler.run_weekly_reports(conn)
                except ApiError as exc:
                    print(f"Relatorio semanal: {exc.message}")
                except Exception as exc:
                    print(f"Falha no relatorio semanal: {exc}")
        except Exception as exc:
            print(f"Falha ao iniciar relatorio semanal: {exc}")
        time.sleep(300)


def goal_reminder_scheduler() -> None:
    while True:
        try:
            with connect() as conn:
                handler = object.__new__(HypersalesHandler)
                tenant_rows = conn.execute("SELECT id FROM tenants WHERE status = 'active' ORDER BY id").fetchall()
                for tenant in tenant_rows:
                    TENANT_CONTEXT[id(conn)] = {"tenant_id": tenant["id"]}
                    try:
                        handler.run_goal_reminders(conn)
                    except ApiError as exc:
                        print(f"Cobranca de metas: {exc.message}")
                    except Exception as exc:
                        print(f"Falha na cobranca de metas: {exc}")
        except Exception as exc:
            print(f"Falha ao iniciar cobranca de metas: {exc}")
        time.sleep(3600)


def whatsapp_auto_reply_scheduler() -> None:
    while True:
        try:
            with connect() as conn:
                handler = object.__new__(HypersalesHandler)
                tenant_rows = conn.execute("SELECT id FROM tenants WHERE status = 'active' ORDER BY id").fetchall()
                for tenant in tenant_rows:
                    TENANT_CONTEXT[id(conn)] = {"tenant_id": tenant["id"]}
                    whatsapp = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
                    if not whatsapp.get("enabled") or not whatsapp.get("connected") or not whatsapp.get("unavailable_reply_enabled"):
                        continue
                    instance_name = whatsapp.get("instance_id") or evolution_instance_name(conn)
                    result = evolution_try_request(
                        "POST",
                        f"/chat/findMessages/{quote_plus(instance_name)}",
                        {"where": {}, "limit": 12},
                        timeout=15,
                    )
                    records = ((result.get("messages") or {}).get("records") or []) if isinstance(result, dict) else []
                    cutoff = int(time.time()) - 180
                    for message in reversed(records):
                        try:
                            if int(message.get("messageTimestamp") or 0) < cutoff:
                                continue
                            handler.reply_to_incoming_whatsapp_message(conn, whatsapp, instance_name, message)
                        except Exception as exc:
                            print(f"Falha auto resposta WhatsApp: {exc}")
        except Exception as exc:
            print(f"Falha no monitor WhatsApp: {exc}")
        time.sleep(8)


def main() -> None:
    init_db()
    threading.Thread(target=weekly_report_scheduler, daemon=True).start()
    threading.Thread(target=goal_reminder_scheduler, daemon=True).start()
    threading.Thread(target=whatsapp_auto_reply_scheduler, daemon=True).start()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), HypersalesHandler)
    print(f"Hipersales rodando em http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
