from __future__ import annotations

"""Coleta e consolidação de dados para relatórios."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class ReportDataMixin:
    def weekly_report_period(self, now: datetime | None = None) -> tuple[datetime, datetime, str]:
        current = now or datetime.now(REPORT_TIMEZONE)
        period_end = current.astimezone(timezone.utc)
        period_start = (current - timedelta(days=365)).astimezone(timezone.utc)
        week_key = current.strftime("%G-W%V")
        return period_start, period_end, week_key

    def seller_weekly_report_data(
        self,
        conn: sqlite3.Connection,
        seller_id: int,
        period_start: datetime,
        period_end: datetime,
    ) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        seller = conn.execute(
            """
            SELECT id, name, email, communication_email, whatsapp_phone
            FROM users
            WHERE id = ? AND tenant_id = ? AND role = 'seller' AND active = 1
            """,
            (seller_id, tenant_id),
        ).fetchone()
        if not seller:
            raise ApiError(HTTPStatus.NOT_FOUND, "Representante nao encontrado.")

        start_iso = period_start.isoformat()
        end_iso = period_end.isoformat()

        orders = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    p.id,
                    p.order_number,
                    p.status,
                    p.created_at,
                    c.legal_name AS customer_name,
                    c.trade_name AS customer_trade_name,
                    c.cnpj AS customer_cnpj,
                    c.id AS customer_id,
                    SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposals p
                JOIN customers c ON c.id = p.customer_id
                LEFT JOIN proposal_items pi ON pi.proposal_id = p.id
                WHERE p.tenant_id = ? AND p.seller_id = ? AND p.created_at >= ? AND p.created_at <= ?
                GROUP BY p.id
                ORDER BY p.created_at DESC
                """,
                (tenant_id, seller_id, start_iso, end_iso),
            )
        ]

        status_rows = conn.execute(
            """
            SELECT
                p.status AS status,
                COUNT(DISTINCT p.id) AS count,
                COALESCE(SUM(order_totals.total), 0) AS total
            FROM proposals p
            JOIN (
                SELECT p2.id, SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposals p2
                LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                WHERE p2.tenant_id = ? AND p2.seller_id = ? AND p2.created_at >= ? AND p2.created_at <= ?
                GROUP BY p2.id
            ) AS order_totals ON order_totals.id = p.id
            WHERE p.tenant_id = ? AND p.seller_id = ? AND p.created_at >= ? AND p.created_at <= ?
            GROUP BY p.status
            """,
            (tenant_id, seller_id, start_iso, end_iso, tenant_id, seller_id, start_iso, end_iso),
        ).fetchall()

        monthly_rows = conn.execute(
            """
            SELECT
                substr(p.created_at, 1, 7) AS month_key,
                COUNT(DISTINCT p.id) AS count,
                COALESCE(SUM(order_totals.total), 0) AS total
            FROM proposals p
            JOIN (
                SELECT p2.id, SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposals p2
                LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                WHERE p2.tenant_id = ? AND p2.seller_id = ? AND p2.created_at >= ? AND p2.created_at <= ?
                GROUP BY p2.id
            ) AS order_totals ON order_totals.id = p.id
            WHERE p.tenant_id = ? AND p.seller_id = ? AND p.created_at >= ? AND p.created_at <= ?
            GROUP BY month_key
            ORDER BY month_key
            """,
            (tenant_id, seller_id, start_iso, end_iso, tenant_id, seller_id, start_iso, end_iso),
        ).fetchall()

        customer_rows = conn.execute(
            """
            SELECT
                c.id,
                c.legal_name,
                c.trade_name,
                c.cnpj,
                MAX(p.created_at) AS last_order_at,
                COUNT(DISTINCT p.id) AS order_count,
                COALESCE(SUM(order_totals.total), 0) AS total
            FROM customer_sellers cs
            JOIN customers c ON c.id = cs.customer_id
            LEFT JOIN proposals p ON p.customer_id = c.id AND p.seller_id = cs.seller_id AND p.tenant_id = c.tenant_id
            LEFT JOIN (
                SELECT p2.id, p2.customer_id, SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposals p2
                LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                WHERE p2.tenant_id = ? AND p2.seller_id = ? AND p2.created_at >= ? AND p2.created_at <= ?
                GROUP BY p2.id
            ) AS order_totals ON order_totals.id = p.id
            WHERE c.tenant_id = ? AND cs.seller_id = ?
            GROUP BY c.id
            ORDER BY total DESC, c.legal_name
            """,
            (tenant_id, seller_id, start_iso, end_iso, tenant_id, seller_id),
        ).fetchall()

        urgent_cutoff = (period_end - timedelta(days=60)).isoformat()
        urgent_rows = [dict(row) for row in customer_rows if not row["last_order_at"] or str(row["last_order_at"]) < urgent_cutoff]

        status_map: dict[str, dict[str, Any]] = {}
        for row in status_rows:
            status_map[str(row["status"])] = {
                "status": str(row["status"]),
                "label": STATUS_LABELS.get(str(row["status"]), str(row["status"])),
                "count": int(row["count"] or 0),
                "total": float(row["total"] or 0),
            }

        months: list[dict[str, Any]] = []
        for row in monthly_rows:
            month_key = str(row["month_key"] or "")
            months.append({
                "month_key": month_key,
                "label": month_key if not month_key else datetime.strptime(month_key, "%Y-%m").strftime("%m/%Y"),
                "count": int(row["count"] or 0),
                "total": float(row["total"] or 0),
            })

        total_value = sum(float(row["total"] or 0) for row in orders)
        return {
            "seller": dict(seller),
            "period_start": period_start,
            "period_end": period_end,
            "orders": orders,
            "statuses": list(status_map.values()),
            "months": months,
            "customers": [dict(row) for row in customer_rows],
            "urgent_customers": urgent_rows,
            "summary": {
                "orders_count": len(orders),
                "total_value": total_value,
                "customers_count": len(customer_rows),
                "urgent_count": len(urgent_rows),
            },
        }

    def weekly_manager_report_data(
        self,
        conn: sqlite3.Connection,
        period_start: datetime,
        period_end: datetime,
    ) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        start_iso = period_start.isoformat()
        end_iso = period_end.isoformat()
        seller_rows = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    u.id,
                    u.name,
                    COALESCE(NULLIF(u.communication_email, ''), u.email) AS email,
                    COUNT(DISTINCT p.id) AS order_count,
                    COALESCE(SUM(order_totals.total), 0) AS total
                FROM users u
                LEFT JOIN proposals p ON p.seller_id = u.id AND p.tenant_id = u.tenant_id AND p.created_at >= ? AND p.created_at <= ?
                LEFT JOIN (
                    SELECT p2.id, p2.seller_id, SUM(pi.quantity * pi.negotiated_price) AS total
                    FROM proposals p2
                    LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                    WHERE p2.tenant_id = ? AND p2.created_at >= ? AND p2.created_at <= ?
                    GROUP BY p2.id
                ) AS order_totals ON order_totals.id = p.id
                WHERE u.tenant_id = ? AND u.role = 'seller' AND u.active = 1
                GROUP BY u.id
                ORDER BY total DESC, u.name
                """,
                (start_iso, end_iso, tenant_id, start_iso, end_iso, tenant_id),
            )
        ]
        top_products = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    pr.name,
                    co.name AS company_name,
                    SUM(pi.quantity) AS quantity,
                    SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposal_items pi
                JOIN proposals p ON p.id = pi.proposal_id
                JOIN products pr ON pr.id = pi.product_id
                JOIN companies co ON co.id = pr.company_id
                WHERE p.tenant_id = ? AND p.created_at >= ? AND p.created_at <= ?
                GROUP BY pr.id
                ORDER BY total DESC
                LIMIT 5
                """,
                (tenant_id, start_iso, end_iso),
            )
        ]
        return {
            "period_start": period_start,
            "period_end": period_end,
            "sellers": seller_rows,
            "top_products": top_products,
        }

    def customer_performance_report_data(self, conn: sqlite3.Connection, customer_id: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        customer = conn.execute(
            """
            SELECT
                c.*,
                (
                    SELECT COUNT(*)
                    FROM customer_sellers cs
                    WHERE cs.customer_id = c.id
                ) AS seller_count,
                (
                    SELECT group_concat(u.name, ', ')
                    FROM customer_sellers cs
                    JOIN users u ON u.id = cs.seller_id
                    WHERE cs.customer_id = c.id
                ) AS seller_names
            FROM customers c
            WHERE c.id = ? AND c.tenant_id = ?
            """,
            (customer_id, tenant_id),
        ).fetchone()
        if not customer:
            raise ApiError(HTTPStatus.NOT_FOUND, "Cliente nao encontrado.")

        orders = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    p.id,
                    p.order_number,
                    p.created_at,
                    p.status,
                    p.payment_terms,
                    COALESCE(SUM(pi.quantity * pi.negotiated_price), 0) AS total,
                    (
                        SELECT MIN(pe.created_at)
                        FROM proposal_events pe
                        WHERE pe.proposal_id = p.id AND pe.status IN ('faturado', 'entregue')
                    ) AS billed_at
                FROM proposals p
                LEFT JOIN proposal_items pi ON pi.proposal_id = p.id
                WHERE p.tenant_id = ? AND p.customer_id = ?
                GROUP BY p.id
                ORDER BY p.created_at ASC, p.id ASC
                """,
                (tenant_id, customer_id),
            )
        ]

        product_rows = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    pr.code,
                    pr.name,
                    pr.unit,
                    SUM(pi.quantity) AS quantity,
                    SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposal_items pi
                JOIN proposals p ON p.id = pi.proposal_id
                JOIN products pr ON pr.id = pi.product_id
                WHERE p.tenant_id = ? AND p.customer_id = ?
                GROUP BY pr.id
                ORDER BY total DESC, pr.name
                """,
                (tenant_id, customer_id),
            )
        ]

        order_dates = [parse_report_datetime(row["created_at"]) for row in orders if row.get("created_at")]
        first_order_at = order_dates[0] if order_dates else None
        last_order_at = order_dates[-1] if order_dates else None
        total_orders = len(orders)
        total_value = sum(float(row.get("total") or 0) for row in orders)
        current = datetime.now(REPORT_TIMEZONE)
        month_span = 1
        if first_order_at:
            month_span = max(1, (current.year - first_order_at.year) * 12 + (current.month - first_order_at.month) + 1)
        avg_monthly = total_value / month_span if month_span else 0.0
        avg_order_value = total_value / total_orders if total_orders else 0.0
        payment_days: list[float] = []
        for row in orders:
            if str(row.get("payment_terms") or "").strip():
                payment_days.append(payment_term_days(row.get("payment_terms")))
        avg_payment_days = round(sum(payment_days) / len(payment_days), 2) if payment_days else 0.0
        reorder_days = 0
        if len(order_dates) > 1:
            diffs = [(order_dates[index] - order_dates[index - 1]).days for index in range(1, len(order_dates))]
            reorder_days = round(sum(diffs) / len(diffs)) if diffs else 0

        lead_time_rows: list[dict[str, Any]] = []
        for row in orders:
            created_at = parse_report_datetime(row["created_at"]) if row.get("created_at") else None
            billed_at = parse_report_datetime(row["billed_at"]) if row.get("billed_at") else None
            lead_time_days = None
            if created_at and billed_at:
                lead_time_days = max(0, (billed_at.date() - created_at.date()).days)
            lead_time_rows.append({
                **row,
                "created_at_dt": created_at,
                "billed_at_dt": billed_at,
                "lead_time_days": lead_time_days,
            })
        lead_time_values = [row["lead_time_days"] for row in lead_time_rows if isinstance(row.get("lead_time_days"), int)]
        avg_lead_time = round(sum(lead_time_values) / len(lead_time_values)) if lead_time_values else 0

        orders_with_variation: list[dict[str, Any]] = []
        previous_total = None
        for row in orders:
            created_at = parse_report_datetime(row["created_at"]) if row.get("created_at") else None
            total = float(row.get("total") or 0)
            variation_label = "Início"
            if previous_total not in (None, 0):
                variation = ((total - previous_total) / previous_total) * 100
                variation_label = f"{variation:+.2f}%".replace(".", ",").replace("+", "+ ")
            orders_with_variation.append({
                **row,
                "created_at_dt": created_at,
                "variation_label": variation_label,
            })
            previous_total = total

        return {
            "customer": dict(customer),
            "orders": orders_with_variation,
            "products": product_rows,
            "summary": {
                "first_order_at": first_order_at,
                "last_order_at": last_order_at,
                "total_orders": total_orders,
                "total_value": total_value,
                "avg_monthly": avg_monthly,
                "avg_order_value": avg_order_value,
                "avg_payment_days": avg_payment_days,
                "reorder_days": reorder_days,
                "avg_lead_time": avg_lead_time,
            },
            "lead_time_rows": lead_time_rows,
        }

    def admin_report_period_filter(self, query: dict[str, list[str]]) -> tuple[str, list[Any], list[str]]:
        where = ["p.tenant_id = ?"]
        params: list[Any] = []
        meta: list[str] = []

        def local_date_iso(value: str, end: bool = False) -> str:
            parsed = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=REPORT_TIMEZONE)
            if end:
                parsed = parsed + timedelta(days=1)
            return parsed.astimezone(timezone.utc).isoformat()

        date_from = str(query.get("date_from", [""])[0] or "").strip()
        date_to = str(query.get("date_to", [""])[0] or "").strip()
        if date_from:
            where.append("p.created_at >= ?")
            params.append(local_date_iso(date_from))
            meta.append(f"De {format_date_for_pdf(date_from)}")
        if date_to:
            where.append("p.created_at < ?")
            params.append(local_date_iso(date_to, True))
            meta.append(f"Ate {format_date_for_pdf(date_to)}")
        seller_id = str(query.get("seller_id", [""])[0] or "").strip()
        company_id = str(query.get("company_id", [""])[0] or "").strip()
        customer_id = str(query.get("customer_id", [""])[0] or "").strip()
        customer_id = str(query.get("customer_id", [""])[0] or "").strip()
        status = str(query.get("status", [""])[0] or "").strip()
        if seller_id:
            where.append("p.seller_id = ?")
            params.append(int(seller_id))
            meta.append(f"Representante #{seller_id}")
        if company_id:
            where.append("p.company_id = ?")
            params.append(int(company_id))
            meta.append(f"Empresa #{company_id}")
        if customer_id:
            where.append("p.customer_id = ?")
            params.append(int(customer_id))
            meta.append(f"Cliente #{customer_id}")
        if status:
            where.append("p.status = ?")
            params.append(status)
            meta.append(f"Status {STATUS_LABELS.get(status, status)}")
        return " AND ".join(where), params, meta

    def admin_report_filter_labels(self, conn: sqlite3.Connection, query: dict[str, list[str]]) -> dict[str, str]:
        tenant_id = current_tenant_id(conn)
        date_from = str(query.get("date_from", [""])[0] or "").strip()
        date_to = str(query.get("date_to", [""])[0] or "").strip()
        status = str(query.get("status", [""])[0] or "").strip()
        seller_id = str(query.get("seller_id", [""])[0] or "").strip()
        company_id = str(query.get("company_id", [""])[0] or "").strip()
        customer_id = str(query.get("customer_id", [""])[0] or "").strip()

        seller_label = "TODOS"
        if seller_id:
            seller = conn.execute("SELECT name FROM users WHERE id = ? AND tenant_id = ?", (int(seller_id), tenant_id)).fetchone()
            seller_label = str(seller["name"] if seller else f"#{seller_id}").upper()

        company_label = "TODAS"
        if company_id:
            company = conn.execute("SELECT name FROM companies WHERE id = ? AND tenant_id = ?", (int(company_id), tenant_id)).fetchone()
            company_label = str(company["name"] if company else f"#{company_id}").upper()

        customer_label = "TODOS"
        if customer_id:
            customer = conn.execute("SELECT legal_name FROM customers WHERE id = ? AND tenant_id = ?", (int(customer_id), tenant_id)).fetchone()
            customer_label = str(customer["legal_name"] if customer else f"#{customer_id}").upper()

        return {
            "date_from": format_date_for_pdf(date_from) if date_from else "TODAS",
            "date_to": format_date_for_pdf(date_to) if date_to else "TODAS",
            "status": str(STATUS_LABELS.get(status, status) if status else "TODOS").upper(),
            "seller": seller_label,
            "company": company_label,
            "customer": customer_label,
        }

    def admin_report_data(self, conn: sqlite3.Connection, report_type: str, query: dict[str, list[str]]) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        where_sql, params, meta = self.admin_report_period_filter(query)
        params = [tenant_id, *params]
        report_key = slugify(report_type or "vendas").replace("-", "_")

        base_order_select = """
            SELECT
                p.id,
                p.order_number,
                p.created_at,
                p.status,
                p.order_type,
                p.payment_terms,
                p.delivery_forecast,
                p.industry_order_number,
                p.invoice_number,
                u.name AS seller_name,
                co.name AS company_name,
                c.legal_name AS customer_name,
                c.cnpj AS customer_cnpj,
                COALESCE(SUM(pi.quantity * pi.negotiated_price), 0) AS total,
                COUNT(pi.id) AS item_count
            FROM proposals p
            JOIN users u ON u.id = p.seller_id
            JOIN companies co ON co.id = p.company_id
            JOIN customers c ON c.id = p.customer_id
            LEFT JOIN proposal_items pi ON pi.proposal_id = p.id
            WHERE {where}
            {extra}
            GROUP BY p.id
            ORDER BY p.created_at DESC, p.id DESC
        """

        def rows_for_orders(extra: str = "") -> list[dict[str, Any]]:
            return [dict(row) for row in conn.execute(base_order_select.format(where=where_sql, extra=extra), params).fetchall()]

        if report_key in {"vendas", "relatorio_de_vendas"}:
            rows = rows_for_orders("AND p.status <> 'recusado'")
            return {
                "title": "RELATORIO DE VENDAS",
                "subtitle": "Propostas enviadas e aprovadas no recorte.",
                "meta": meta,
                "summary": [
                    ("Pedidos", len(rows)),
                    ("Valor total", format_brl(sum(float(row["total"] or 0) for row in rows))),
                    ("Ticket medio", format_brl(sum(float(row["total"] or 0) for row in rows) / len(rows) if rows else 0)),
                ],
                "columns": ["Pedido", "Data", "Representante", "Empresa", "Cliente", "Status", "Total"],
                "rows": [
                    [
                        f"#{row.get('order_number') or row.get('id')}",
                        format_date_for_pdf(row.get("created_at")),
                        row.get("seller_name"),
                        row.get("company_name"),
                        row.get("customer_name"),
                        STATUS_LABELS.get(str(row.get("status")), row.get("status")),
                        format_brl(float(row.get("total") or 0)),
                    ]
                    for row in rows
                ],
            }

        if report_key in {"acompanhamento", "acompanhamento_de_pedidos", "pedidos"}:
            rows = rows_for_orders("")
            return {
                "title": "RELATORIO DE ACOMPANHAMENTO DE PEDIDOS",
                "subtitle": "Pedidos e seus respectivos status.",
                "meta": meta,
                "filters": self.admin_report_filter_labels(conn, query),
                "summary": [
                    ("Qtde Pedidos", len(rows)),
                    ("Valor Total dos Pedidos", format_brl(sum(float(row["total"] or 0) for row in rows))),
                ],
                "columns": [
                    "Nº Pedido",
                    "Nº Pedido na Indústria",
                    "Nº Nota Fiscal",
                    "Dt.Emissão Pedido",
                    "Entrega Prevista",
                    "Representante",
                    "Empresa",
                    "Cliente",
                    "Valor do Pedido",
                    "Status do Pedido",
                ],
                "rows": [
                    [
                        f"#{row.get('order_number') or row.get('id')}",
                        row.get("industry_order_number") or "-",
                        row.get("invoice_number") or "-",
                        format_date_for_pdf(row.get("created_at")),
                        format_date_for_pdf(row.get("delivery_forecast")) or "-",
                        row.get("seller_name"),
                        row.get("company_name"),
                        row.get("customer_name"),
                        format_brl(float(row.get("total") or 0)),
                        STATUS_LABELS.get(str(row.get("status")), row.get("status")),
                    ]
                    for row in rows
                ],
            }

        if report_key in {"bonificacoes", "relatorio_de_bonificacoes", "bonificacao"}:
            rows = rows_for_orders("AND lower(p.order_type) LIKE '%bonifica%'")
            return {
                "title": "RELATORIO DE BONIFICACOES",
                "subtitle": "Pedidos classificados como bonificacao.",
                "meta": meta,
                "summary": [
                    ("Bonificacoes", len(rows)),
                    ("Valor mapeado", format_brl(sum(float(row["total"] or 0) for row in rows))),
                    ("Itens", sum(int(row.get("item_count") or 0) for row in rows)),
                ],
                "columns": ["Pedido", "Data", "Representante", "Empresa", "Cliente", "Status", "Itens", "Valor"],
                "rows": [
                    [
                        f"#{row.get('order_number') or row.get('id')}",
                        format_date_for_pdf(row.get("created_at")),
                        row.get("seller_name"),
                        row.get("company_name"),
                        row.get("customer_name"),
                        STATUS_LABELS.get(str(row.get("status")), row.get("status")),
                        row.get("item_count") or 0,
                        format_brl(float(row.get("total") or 0)),
                    ]
                    for row in rows
                ],
            }

        if report_key in {"produtos", "produtos_vendidos", "relatorio_de_produtos_vendidos"}:
            rows = [
                dict(row)
                for row in conn.execute(
                    f"""
                    SELECT
                        pr.code,
                        pr.name,
                        pr.unit,
                        co.name AS company_name,
                        COUNT(DISTINCT p.id) AS order_count,
                        SUM(pi.quantity) AS quantity,
                        AVG(pi.negotiated_price) AS avg_price,
                        SUM(pi.quantity * pi.negotiated_price) AS total
                    FROM proposal_items pi
                    JOIN proposals p ON p.id = pi.proposal_id
                    JOIN products pr ON pr.id = pi.product_id
                    JOIN companies co ON co.id = pr.company_id
                    WHERE {where_sql}
                      AND p.status <> 'recusado'
                    GROUP BY pr.id
                    ORDER BY total DESC, quantity DESC
                    """,
                    params,
                ).fetchall()
            ]
            return {
                "title": "RELATORIO DE PRODUTOS VENDIDOS",
                "subtitle": "Produtos com venda/saida no recorte.",
                "meta": meta,
                "summary": [
                    ("Produtos", len(rows)),
                    ("Qtd total", format_decimal_pt(sum(float(row.get("quantity") or 0) for row in rows))),
                    ("Valor total", format_brl(sum(float(row.get("total") or 0) for row in rows))),
                ],
                "columns": ["Codigo", "Produto", "Empresa", "Unidade", "Pedidos", "Qtd", "Preco medio", "Total"],
                "rows": [
                    [
                        row.get("code"),
                        row.get("name"),
                        row.get("company_name"),
                        row.get("unit"),
                        row.get("order_count") or 0,
                        format_decimal_pt(row.get("quantity") or 0),
                        format_brl(float(row.get("avg_price") or 0)),
                        format_brl(float(row.get("total") or 0)),
                    ]
                    for row in rows
                ],
            }

        if report_key in {"prazo", "prazo_pagamento", "relatorio_de_prazo_pagamento"}:
            order_rows = rows_for_orders("AND p.status <> 'recusado' AND COALESCE(p.payment_terms, '') <> ''")
            grouped: dict[str, dict[str, Any]] = {}
            for row in order_rows:
                term = str(row.get("payment_terms") or "Sem pagamento")
                grouped.setdefault(term, {"term": term, "count": 0, "total": 0.0, "days": payment_term_days(term)})
                grouped[term]["count"] += 1
                grouped[term]["total"] += float(row.get("total") or 0)
            rows = sorted(grouped.values(), key=lambda item: item["days"])
            total_orders = sum(item["count"] for item in rows)
            avg_days = sum(float(item["days"]) * int(item["count"]) for item in rows) / total_orders if total_orders else 0
            return {
                "title": "RELATORIO DE PRAZO DE PAGAMENTO",
                "subtitle": "Prazo medio negociado por condicao comercial.",
                "meta": meta,
                "summary": [
                    ("Pedidos", total_orders),
                    ("Prazo medio", f"{format_decimal_pt(avg_days)} dias"),
                    ("Valor total", format_brl(sum(float(item["total"]) for item in rows))),
                ],
                "columns": ["Condicao de pagamento", "Prazo medio", "Pedidos", "Valor total"],
                "rows": [
                    [item["term"], f"{format_decimal_pt(item['days'])} dias", item["count"], format_brl(item["total"])]
                    for item in rows
                ],
            }

        if report_key in {"fechamento", "fechamento_representante", "fechamento_mensal"}:
            rows = [
                dict(row)
                for row in conn.execute(
                    f"""
                    SELECT
                        u.id,
                        u.name AS seller_name,
                        COUNT(DISTINCT p.id) AS order_count,
                        COUNT(DISTINCT p.customer_id) AS attended_customers,
                        COALESCE(SUM(order_totals.total), 0) AS total,
                        SUM(CASE WHEN p.status = 'em_producao' THEN 1 ELSE 0 END) AS production_count,
                        SUM(CASE WHEN p.status = 'faturado' THEN 1 ELSE 0 END) AS billed_count,
                        SUM(CASE WHEN p.status = 'entregue' THEN 1 ELSE 0 END) AS delivered_count
                    FROM users u
                    LEFT JOIN proposals p ON p.seller_id = u.id AND {where_sql}
                    LEFT JOIN (
                        SELECT p2.id, SUM(pi.quantity * pi.negotiated_price) AS total
                        FROM proposals p2
                        LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                        WHERE p2.tenant_id = ?
                        GROUP BY p2.id
                    ) AS order_totals ON order_totals.id = p.id
                    WHERE u.tenant_id = ? AND u.role = 'seller' AND u.active = 1
                    GROUP BY u.id
                    ORDER BY total DESC, u.name
                    """,
                    [*params, tenant_id, tenant_id],
                ).fetchall()
            ]
            return {
                "title": "FECHAMENTO MENSAL POR REPRESENTANTE",
                "subtitle": "Resumo de performance por representante comercial.",
                "meta": meta,
                "summary": [
                    ("Representantes", len(rows)),
                    ("Pedidos", sum(int(row.get("order_count") or 0) for row in rows)),
                    ("Valor total", format_brl(sum(float(row.get("total") or 0) for row in rows))),
                ],
                "columns": ["Representante", "Pedidos", "Valor total", "Ticket medio", "Em producao", "Faturados", "Entregues", "Clientes atendidos"],
                "rows": [
                    [
                        row.get("seller_name"),
                        row.get("order_count") or 0,
                        format_brl(float(row.get("total") or 0)),
                        format_brl(float(row.get("total") or 0) / int(row.get("order_count") or 1) if int(row.get("order_count") or 0) else 0),
                        row.get("production_count") or 0,
                        row.get("billed_count") or 0,
                        row.get("delivered_count") or 0,
                        row.get("attended_customers") or 0,
                    ]
                    for row in rows
                ],
            }

        raise ApiError(HTTPStatus.BAD_REQUEST, "Tipo de relatorio invalido.")
