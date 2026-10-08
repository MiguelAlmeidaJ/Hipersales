from __future__ import annotations

"""Rotinas de relatórios, lembretes e operação legada."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class BackgroundJobsMixin:
    def run_weekly_reports(self, conn: sqlite3.Connection, force: bool = False) -> dict[str, Any]:
        current = datetime.now(REPORT_TIMEZONE)
        if not force and current.weekday() != 4:
            return {"sent": False, "message": "Relatorios semanais sao enviados nas sextas-feiras."}
        period_start, period_end, week_key = self.weekly_report_period(current)
        if not force:
            last_week = first_text(read_setting(conn, WEEKLY_REPORT_SETTING_KEY, ""))
            if last_week == week_key:
                return {"sent": False, "week": week_key, "message": "Relatorios desta semana ja foram enviados."}
        sellers = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, name, email, communication_email, whatsapp_phone
                FROM users
                WHERE role = 'seller' AND active = 1
                ORDER BY name
                """
            )
        ]
        manager_recipients = [
            recipient for recipient in ["vendas@hipermixrepresentacoes.com.br"] if recipient
        ]
        manager_report = self.weekly_manager_report_data(conn, period_start, period_end)
        manager_pdf = self.weekly_manager_report_pdf(manager_report)
        if manager_recipients:
            send_email_message(
                conn,
                "weekly_manager_report",
                ",".join(manager_recipients),
                f"Relatorio semanal gerencial - {period_end.astimezone(REPORT_TIMEZONE).strftime('%d/%m/%Y')}",
                "Segue em anexo o consolidado semanal gerencial do HiperSales Web.",
                attachments=[{"filename": f"relatorio-gerencial-{week_key}.pdf", "content": manager_pdf, "mimetype": "application/pdf"}],
            )
            send_email_message(
                conn,
                "weekly_manager_report_owner",
                "thallesmachadocomercial@gmail.com",
                f"Relatorio gerencial semanal - {period_end.astimezone(REPORT_TIMEZONE).strftime('%d/%m/%Y')}",
                "Segue em anexo o seu panorama gerencial semanal do HiperSales Web. Este material sera refinado com os indicadores gerenciais específicos que definirmos juntos.",
                attachments=[{"filename": f"relatorio-gerencial-thalles-{week_key}.pdf", "content": manager_pdf, "mimetype": "application/pdf"}],
            )

        sent_sellers = 0
        for seller in sellers:
            recipients = [recipient for recipient in [seller.get("communication_email"), seller.get("email")] if recipient]
            if not recipients:
                continue
            seller_report = self.seller_weekly_report_data(conn, seller["id"], period_start, period_end)
            seller_pdf = self.weekly_seller_report_pdf(seller_report)
            send_email_message(
                conn,
                "weekly_seller_report",
                ",".join(dict.fromkeys(recipients)),
                f"Minhas atividades do mobile - {seller['name']}",
                f"Olá, {seller['name']}.\n\nAbaixo uma análise das suas atividades. Avalie sua performance.\n\nSegue em anexo o seu resumo estratégico semanal do HiperSales Web, referente ao período de {format_date_for_pdf(period_start)} a {format_date_for_pdf(period_end)}.",
                attachments=[{"filename": f"relatorio-atividades-{seller['id']}-{week_key}.pdf", "content": seller_pdf, "mimetype": "application/pdf"}],
            )
            sent_sellers += 1
        write_setting(conn, WEEKLY_REPORT_SETTING_KEY, week_key)
        return {"sent": True, "week": week_key, "sellers": sent_sellers}

    def goal_reminder_message(self, seller: dict[str, Any], performance: dict[str, Any]) -> str:
        month_label = f"{int(performance['month']):02d}/{int(performance['year'])}"

        def pct(value: Any) -> str:
            return f"{float(value or 0):.2f}%".replace(".", ",")

        lines = [
            f"Olá, {seller['name']}.",
            "",
            f"Estamos acompanhando sua performance de metas no HiperSales Web para {month_label}.",
            "",
        ]
        sales = performance["sales"]
        if sales["enabled"]:
            lines.extend([
                "Meta de faturamento/propostas:",
                f"Meta: {format_brl(float(sales['goal'] or 0))}",
                f"Realizado: {format_brl(float(sales['realized'] or 0))}",
                f"Falta: {format_brl(float(sales['missing'] or 0))} ({pct(100 - float(sales['percent'] or 0))} restante)",
                "",
            ])
        customers = performance["new_customers"]
        if customers["enabled"]:
            lines.extend([
                "Meta de novos clientes:",
                f"Meta: {int(customers['goal'] or 0)}",
                f"Realizado: {int(customers['realized'] or 0)}",
                f"Falta: {int(customers['missing'] or 0)} ({pct(100 - float(customers['percent'] or 0))} restante)",
                "",
            ])
        positivation = performance["customer_positivation"]
        if positivation["enabled"]:
            lines.extend([
                "Meta de positivação da carteira:",
                f"Meta: {pct(positivation['goal'])}",
                f"Realizado: {pct(positivation['realized'])}",
                f"Falta: {pct(positivation['missing'])}",
                "",
            ])
        lines.extend([
            "Acompanhe os detalhes em Minhas Atividades no HiperSales Web.",
            "Ótimas vendas!",
        ])
        return "\n".join(lines)

    def run_goal_reminders(self, conn: sqlite3.Connection, force: bool = False) -> dict[str, Any]:
        current = datetime.now(REPORT_TIMEZONE)
        if not force and current.day not in GOAL_REMINDER_DAYS:
            return {"sent": False, "message": "Dia fora da regua de cobranca de metas."}
        tenant_id = current_tenant_id(conn)
        year, month, _, _ = self.goal_period(current.year, current.month)
        sellers = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, name, email, communication_email, whatsapp_phone
                FROM users
                WHERE tenant_id = ? AND role = 'seller' AND active = 1
                ORDER BY name
                """,
                (tenant_id,),
            )
        ]
        whatsapp = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
        sent = 0
        skipped = 0
        for seller in sellers:
            performance = self.seller_goal_performance(conn, int(seller["id"]), year, month)
            if not performance.get("has_goals"):
                skipped += 1
                continue
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO seller_goal_reminders
                    (tenant_id, seller_id, year, month, day, sent_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (tenant_id, seller["id"], year, month, current.day, now_iso()),
            )
            if cur.rowcount == 0 and not force:
                skipped += 1
                continue
            body = self.goal_reminder_message(seller, performance)
            recipient = first_text(seller.get("communication_email"), seller.get("email"))
            if recipient:
                queue_outbox(conn, "goal_reminder_email", recipient, f"Meta comercial {month:02d}/{year} - {seller['name']}", body)
            if whatsapp.get("enabled") and whatsapp.get("connected") and seller.get("whatsapp_phone"):
                queue_outbox(conn, "goal_reminder_whatsapp", f"whatsapp:{seller['whatsapp_phone']}", f"Meta comercial {month:02d}/{year}", body)
            sent += 1
        return {"sent": True, "year": year, "month": month, "day": current.day, "sellers": sent, "skipped": skipped}

    def assign_customer(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["customer_id", "seller_id"])
        conn.execute(
            "INSERT OR IGNORE INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)",
            (data["customer_id"], data["seller_id"]),
        )
        return {"message": "Cliente associado ao representante comercial."}
