from __future__ import annotations

"""Superadministração, dashboard e metas comerciais."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class TenantGoalsMixin:
    def super_admin_overview(self, conn: sqlite3.Connection) -> dict[str, Any]:
        summary = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM tenants) AS tenants,
                (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants,
                (SELECT COUNT(*) FROM users WHERE COALESCE(is_super_admin, 0) = 0) AS tenant_users,
                (SELECT COUNT(*) FROM proposals) AS proposals,
                (SELECT COUNT(*) FROM email_outbox) AS outbox
            """
        ).fetchone()
        return {"summary": dict(summary), "tenants": self.super_admin_tenants(conn)}

    def super_admin_tenants(self, conn: sqlite3.Connection) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    t.*,
                    (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS users_count,
                    (SELECT COUNT(*) FROM companies c WHERE c.tenant_id = t.id) AS companies_count,
                    (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id) AS customers_count,
                    (SELECT COUNT(*) FROM proposals p WHERE p.tenant_id = t.id) AS proposals_count
                FROM tenants t
                ORDER BY t.created_at DESC, t.id DESC
                """
            )
        ]

    def super_admin_tenant_detail(self, conn: sqlite3.Connection, tenant_id: int) -> dict[str, Any]:
        """Read-only tenant preview; authorization must be enforced by router."""
        tenant = conn.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,)).fetchone()
        if not tenant:
            raise ApiError(HTTPStatus.NOT_FOUND, "Tenant nao encontrado.")
        counts = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM proposals WHERE tenant_id = ?) AS proposals,
                (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) AS customers,
                (SELECT COUNT(*) FROM products WHERE tenant_id = ?) AS products,
                (SELECT COUNT(*) FROM companies WHERE tenant_id = ?) AS companies,
                (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'seller') AS sellers
            """, (tenant_id,)*5,
        ).fetchone()
        statuses = [
            dict(row) for row in conn.execute(
                "SELECT status, COUNT(*) AS total FROM proposals WHERE tenant_id = ? GROUP BY status ORDER BY total DESC",
                (tenant_id,),
            )
        ]
        recent = [
            dict(row) for row in conn.execute(
                """SELECT p.id, p.order_number, p.status, p.created_at, c.legal_name AS customer_name,
                   COALESCE((SELECT SUM(i.quantity * i.negotiated_price) FROM proposal_items i WHERE i.proposal_id = p.id), 0) AS total
                   FROM proposals p JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
                   WHERE p.tenant_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT 8""",
                (tenant_id,),
            )
        ]
        return {"tenant": dict(tenant), "summary": dict(counts), "statuses": statuses, "recent_orders": recent}

    def super_admin_tenant_dashboard(self, conn: sqlite3.Connection, tenant_id: int, query: dict[str, list[str]]) -> dict[str, Any]:
        """Read-only, tenant-isolated executive dashboard for superadmins."""
        tenant = conn.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,)).fetchone()
        if tenant is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "Tenant nao encontrado.")
        search = str(query.get("q", [""])[0] or "").strip()[:120]
        status = str(query.get("status", [""])[0] or "").strip()[:60]
        date_from = str(query.get("date_from", [""])[0] or "").strip()
        date_to = str(query.get("date_to", [""])[0] or "").strip()
        for value in (date_from, date_to):
            if value:
                try:
                    datetime.strptime(value, "%Y-%m-%d")
                except ValueError as exc:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Data invalida (AAAA-MM-DD).") from exc
        if date_from and date_to and date_from > date_to:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Data inicial posterior a data final.")
        where = ["p.tenant_id = ?"]
        args: list[Any] = [tenant_id]
        if status:
            where.append("p.status = ?")
            args.append(status)
        if date_from:
            where.append("substr(p.created_at,1,10) >= ?")
            args.append(date_from)
        if date_to:
            where.append("substr(p.created_at,1,10) <= ?")
            args.append(date_to)
        if search:
            where.append("""(c.legal_name LIKE ? OR co.name LIKE ? OR
                CAST(p.order_number AS TEXT) LIKE ? OR EXISTS
                (SELECT 1 FROM proposal_items pi JOIN products pr ON pr.id = pi.product_id
                 WHERE pi.proposal_id = p.id AND pr.name LIKE ?))""")
            args.extend([f"%{search}%"] * 4)
        predicate = " AND ".join(where)
        base = f"""FROM proposals p
             JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
             JOIN companies co ON co.id = p.company_id AND co.tenant_id = p.tenant_id
             WHERE {predicate}"""
        totals = dict(conn.execute(f"""SELECT COUNT(*) AS orders, COALESCE(SUM(
            (SELECT SUM(pi.quantity * pi.negotiated_price) FROM proposal_items pi WHERE pi.proposal_id=p.id)
            ),0) AS revenue {base}""", args).fetchone())
        count = int(totals["orders"])
        revenue = float(totals["revenue"] or 0)
        summary = dict(conn.execute("""SELECT
            (SELECT COUNT(*) FROM customers WHERE tenant_id=? AND active=1) AS customers,
            (SELECT COUNT(*) FROM products WHERE tenant_id=? AND active=1) AS products,
            (SELECT COUNT(*) FROM companies WHERE tenant_id=? AND active=1) AS companies,
            (SELECT COUNT(*) FROM users WHERE tenant_id=? AND role='seller' AND active=1) AS sellers,
            (SELECT COUNT(*) FROM registration_requests WHERE tenant_id=? AND status='pendente') AS pending_requests
            """, (tenant_id,)*5).fetchone())
        summary.update({"orders": count, "revenue": revenue, "average_ticket": revenue / count if count else 0})
        statuses = [dict(row) for row in conn.execute(
            f"SELECT p.status AS status, COUNT(*) AS total {base} GROUP BY p.status ORDER BY total DESC", args)]
        company_ranking = [dict(row) for row in conn.execute(
            f"""SELECT co.name AS name, COUNT(*) AS orders,
            COALESCE(SUM((SELECT SUM(pi.quantity*pi.negotiated_price) FROM proposal_items pi WHERE pi.proposal_id=p.id)),0) AS total
            {base} GROUP BY co.id, co.name ORDER BY total DESC LIMIT 5""", args)]
        seller_ranking = [dict(row) for row in conn.execute(
            f"""SELECT u.name AS name, COUNT(*) AS orders,
            COALESCE(SUM((SELECT SUM(pi.quantity*pi.negotiated_price) FROM proposal_items pi WHERE pi.proposal_id=p.id)),0) AS total
            FROM proposals p JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id
            JOIN companies co ON co.id=p.company_id AND co.tenant_id=p.tenant_id
            JOIN users u ON u.id=p.seller_id AND u.tenant_id=p.tenant_id
            WHERE {predicate} GROUP BY u.id, u.name ORDER BY total DESC LIMIT 5""", args)]
        top_products = [dict(row) for row in conn.execute(
            f"""SELECT pr.name AS name, co.name AS company, SUM(pi.quantity) AS quantity,
            SUM(pi.quantity*pi.negotiated_price) AS total
            FROM proposals p JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id
            JOIN companies co ON co.id=p.company_id AND co.tenant_id=p.tenant_id
            JOIN proposal_items pi ON pi.proposal_id=p.id
            JOIN products pr ON pr.id=pi.product_id AND pr.tenant_id=p.tenant_id
            WHERE {predicate} GROUP BY pr.id, pr.name, co.name ORDER BY total DESC LIMIT 5""", args)]
        recent_orders = [dict(row) for row in conn.execute(
            f"""SELECT p.id, p.order_number, c.legal_name AS customer_name, co.name AS company_name,
            p.status, p.created_at, COALESCE((SELECT SUM(pi.quantity*pi.negotiated_price)
            FROM proposal_items pi WHERE pi.proposal_id=p.id),0) AS total
            {base} ORDER BY p.created_at DESC,p.id DESC LIMIT 7""", args)]
        return {
            "tenant": dict(tenant), "summary": summary, "statuses": statuses,
            "company_ranking": company_ranking, "seller_ranking": seller_ranking,
            "top_products": top_products, "recent_orders": recent_orders,
            "filters": {"q": search, "status": status, "date_from": date_from, "date_to": date_to},
        }

    def super_admin_tenant_records(self, conn: sqlite3.Connection, tenant_id: int, section: str, query: dict[str, list[str]]) -> dict[str, Any]:
        """Read-only, allowlisted tenant records for the Superadmin console.

        Never exposes password hashes, credentials, settings values, attachment
        contents or a cross-tenant join.
        """
        tenant = conn.execute("SELECT id, name FROM tenants WHERE id = ?", (tenant_id,)).fetchone()
        if tenant is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "Tenant nao encontrado.")
        definitions = {
            "orders": ("proposals p", "p.id, p.order_number, p.status, p.created_at, c.legal_name AS customer_name, co.name AS company_name, u.name AS seller_name",
                       "LEFT JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id LEFT JOIN companies co ON co.id=p.company_id AND co.tenant_id=p.tenant_id LEFT JOIN users u ON u.id=p.seller_id AND u.tenant_id=p.tenant_id", "p"),
            "occurrences": ("occurrences x", "x.id, x.reason, x.status, x.created_at, c.legal_name AS customer_name, u.name AS seller_name",
                            "LEFT JOIN customers c ON c.id=x.customer_id AND c.tenant_id=x.tenant_id LEFT JOIN users u ON u.id=x.seller_id AND u.tenant_id=x.tenant_id", "x"),
            "customers": ("customers x", "x.id, x.legal_name, x.trade_name, x.cnpj, x.active", "", "x"),
            "companies": ("companies x", "x.id, x.name, x.legal_name, x.active", "", "x"),
            "products": ("products x", "x.id, x.name, x.code, x.price, x.active, c.name AS company_name",
                         "LEFT JOIN companies c ON c.id=x.company_id AND c.tenant_id=x.tenant_id", "x"),
            "users": ("users x", "x.id, x.name, x.email, x.role, x.active", "", "x"),
            "goals": ("seller_goals x", "x.id, x.year, x.month, x.sales_goal, x.new_customers_goal, u.name AS seller_name",
                      "LEFT JOIN users u ON u.id=x.seller_id AND u.tenant_id=x.tenant_id", "x"),
        }
        if section not in definitions:
            raise ApiError(HTTPStatus.NOT_FOUND, "Secao do tenant nao encontrada.")
        source, fields, joins, alias = definitions[section]
        search = str(query.get("q", [""])[0] or "").strip()[:100]
        conditions = [f"{alias}.tenant_id = ?"]
        parameters: list[Any] = [tenant_id]
        if search:
            search_fields = {
                "orders": ["c.legal_name", "co.name", "u.name", "CAST(p.order_number AS TEXT)"],
                "occurrences": ["x.reason", "c.legal_name", "u.name"],
                "customers": ["x.legal_name", "x.trade_name", "x.cnpj"],
                "companies": ["x.name", "x.legal_name"],
                "products": ["x.name", "x.code", "c.name"],
                "users": ["x.name", "x.email"],
                "goals": ["u.name", "CAST(x.year AS TEXT)"],
            }[section]
            conditions.append("(" + " OR ".join(f"COALESCE({col}, '') LIKE ?" for col in search_fields) + ")")
            parameters.extend(["%" + search + "%"] * len(search_fields))
        predicate = " AND ".join(conditions)
        base = f"FROM {source} {joins} WHERE {predicate}"
        total = conn.execute(f"SELECT COUNT(*) AS total {base}", parameters).fetchone()["total"]
        rows = [dict(row) for row in conn.execute(
            f"SELECT {fields} {base} ORDER BY {alias}.id DESC LIMIT 100", parameters)]
        return {"tenant": dict(tenant), "section": section, "total": total,
                "records": rows, "limited": total > len(rows)}
    
    def create_tenant(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["name", "admin_name", "admin_email", "admin_password"])
        name = str(data["name"]).strip()
        slug_base = slugify(data.get("slug") or name)
        slug = slug_base
        suffix = 2
        while conn.execute("SELECT 1 FROM tenants WHERE slug = ?", (slug,)).fetchone():
            slug = f"{slug_base}-{suffix}"
            suffix += 1
        admin_email = normalize_username(data["admin_email"])
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (admin_email,)).fetchone():
            raise ApiError(HTTPStatus.CONFLICT, "Este usuario administrador ja existe.")
        cur = conn.execute(
            "INSERT INTO tenants (name, slug, status, owner_email, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, slug, "active", str(data.get("owner_email") or data["admin_email"]).strip().lower(), now_iso()),
        )
        tenant_id = inserted_id(cur)
        conn.execute(
            """
            INSERT INTO users (tenant_id, name, email, password_hash, role, is_super_admin, active, must_change_password, password_updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                str(data["admin_name"]).strip(),
                admin_email,
                hash_password(str(data["admin_password"])),
                "admin",
                0,
                1,
                0,
                now_iso(),
                now_iso(),
            ),
        )
        return {"message": "Conta criada com base zerada.", "tenant": dict(conn.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,)).fetchone())}

    def dashboard(self, conn: sqlite3.Connection, user: dict[str, Any]) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        if user["role"] == "admin":
            counts = conn.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) AS customers,
                    (SELECT COUNT(*) FROM proposals WHERE tenant_id = ?) AS proposals,
                    (SELECT COUNT(*) FROM proposals WHERE tenant_id = ? AND status = 'pedido_aprovado') AS orders,
                    (SELECT COUNT(*) FROM registration_requests WHERE tenant_id = ? AND status = 'pendente') AS pending_requests
                """,
                (tenant_id, tenant_id, tenant_id, tenant_id),
            ).fetchone()
        else:
            counts = conn.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM customer_sellers WHERE seller_id = ?) AS customers,
                    (SELECT COUNT(*) FROM proposals WHERE seller_id = ?) AS proposals,
                    (SELECT COUNT(*) FROM proposals WHERE seller_id = ? AND status = 'pedido_aprovado') AS orders,
                    (SELECT COUNT(*) FROM registration_requests WHERE seller_id = ? AND status = 'pendente') AS pending_requests
                """,
                (user["id"], user["id"], user["id"], user["id"]),
            ).fetchone()
        return {"summary": dict(counts)}

    def goal_period(self, year: int, month: int) -> tuple[int, int, str, str]:
        current = datetime.now(REPORT_TIMEZONE)
        safe_year = year if 2000 <= int(year or 0) <= 2100 else current.year
        safe_month = month if 1 <= int(month or 0) <= 12 else current.month
        start_local = datetime(safe_year, safe_month, 1, tzinfo=REPORT_TIMEZONE)
        if safe_month == 12:
            end_local = datetime(safe_year + 1, 1, 1, tzinfo=REPORT_TIMEZONE)
        else:
            end_local = datetime(safe_year, safe_month + 1, 1, tzinfo=REPORT_TIMEZONE)
        return safe_year, safe_month, start_local.astimezone(timezone.utc).isoformat(), end_local.astimezone(timezone.utc).isoformat()

    def seller_goal_row(self, conn: sqlite3.Connection, seller_id: int, year: int, month: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        row = conn.execute(
            """
            SELECT sales_goal, new_customers_goal, customer_positivation_goal
            FROM seller_goals
            WHERE tenant_id = ? AND seller_id = ? AND year = ? AND month = ?
            """,
            (tenant_id, seller_id, year, month),
        ).fetchone()
        return dict(row) if row else {"sales_goal": None, "new_customers_goal": None, "customer_positivation_goal": None}

    def seller_goal_performance(self, conn: sqlite3.Connection, seller_id: int, year: int, month: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        year, month, start_iso, end_iso = self.goal_period(year, month)
        goals = self.seller_goal_row(conn, seller_id, year, month)
        sales_row = conn.execute(
            """
            SELECT COUNT(DISTINCT p.id) AS count, COALESCE(SUM(order_totals.total), 0) AS total
            FROM proposals p
            LEFT JOIN (
                SELECT p2.id, SUM(pi.quantity * pi.negotiated_price) AS total
                FROM proposals p2
                LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
                WHERE p2.tenant_id = ? AND p2.seller_id = ? AND p2.created_at >= ? AND p2.created_at < ?
                GROUP BY p2.id
            ) AS order_totals ON order_totals.id = p.id
            WHERE p.tenant_id = ? AND p.seller_id = ? AND p.status <> 'recusado' AND p.created_at >= ? AND p.created_at < ?
            """,
            (tenant_id, seller_id, start_iso, end_iso, tenant_id, seller_id, start_iso, end_iso),
        ).fetchone()
        new_customers = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM registration_requests
            WHERE tenant_id = ? AND seller_id = ? AND status = 'aprovada' AND created_at >= ? AND created_at < ?
            """,
            (tenant_id, seller_id, start_iso, end_iso),
        ).fetchone()["total"]
        portfolio_count = conn.execute(
            """
            SELECT COUNT(DISTINCT c.id) AS total
            FROM customer_sellers cs
            JOIN customers c ON c.id = cs.customer_id
            WHERE c.tenant_id = ? AND c.active = 1 AND cs.seller_id = ?
            """,
            (tenant_id, seller_id),
        ).fetchone()["total"]
        attended_count = conn.execute(
            """
            SELECT COUNT(DISTINCT p.customer_id) AS total
            FROM proposals p
            JOIN customers c ON c.id = p.customer_id
            WHERE p.tenant_id = ? AND p.seller_id = ? AND c.active = 1
              AND p.status <> 'recusado' AND p.created_at >= ? AND p.created_at < ?
            """,
            (tenant_id, seller_id, start_iso, end_iso),
        ).fetchone()["total"]
        positivation = (float(attended_count or 0) / float(portfolio_count or 1) * 100) if portfolio_count else 0.0
        sales_goal = goals.get("sales_goal")
        customers_goal = goals.get("new_customers_goal")
        positivation_goal = goals.get("customer_positivation_goal")

        def progress(goal: Any, realized: float) -> dict[str, Any]:
            if goal in (None, ""):
                return {"enabled": False, "goal": None, "realized": realized, "missing": 0, "percent": 0}
            goal_value = float(goal or 0)
            missing = max(0.0, goal_value - float(realized or 0))
            percent = min(100.0, (float(realized or 0) / goal_value * 100.0)) if goal_value > 0 else 100.0
            return {"enabled": True, "goal": goal_value, "realized": float(realized or 0), "missing": missing, "percent": percent}

        return {
            "year": year,
            "month": month,
            "has_goals": any(goals.get(key) not in (None, "") for key in ("sales_goal", "new_customers_goal", "customer_positivation_goal")),
            "sales": progress(sales_goal, float(sales_row["total"] or 0)),
            "new_customers": progress(customers_goal, float(new_customers or 0)),
            "customer_positivation": progress(positivation_goal, positivation),
            "portfolio": {
                "customers": int(portfolio_count or 0),
                "attended": int(attended_count or 0),
            },
        }

    def seller_goals_payload(self, conn: sqlite3.Connection, seller_id: int, year: int, month: int) -> dict[str, Any]:
        user = conn.execute(
            "SELECT id, name FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller'",
            (seller_id, current_tenant_id(conn)),
        ).fetchone()
        if not user:
            raise ApiError(HTTPStatus.NOT_FOUND, "Representante nao encontrado.")
        return {"seller": dict(user), "goals": self.seller_goal_performance(conn, seller_id, year, month)}

    def admin_goals(self, conn: sqlite3.Connection, year: int, month: int) -> dict[str, Any]:
        year, month, _, _ = self.goal_period(year, month)
        sellers = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, name, email, communication_email, whatsapp_phone, active
                FROM users
                WHERE tenant_id = ? AND role = 'seller'
                ORDER BY active DESC, name
                """,
                (current_tenant_id(conn),),
            )
        ]
        rows = []
        for seller in sellers:
            performance = self.seller_goal_performance(conn, int(seller["id"]), year, month)
            rows.append({"seller": seller, "goals": performance})
        return {"year": year, "month": month, "rows": rows, "reminder_days": sorted(GOAL_REMINDER_DAYS)}

    def save_admin_goals(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        year, month, _, _ = self.goal_period(coerce_int(data.get("year"), 0), coerce_int(data.get("month"), 0))
        rows = data.get("goals")
        if not isinstance(rows, list):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe as metas dos representantes.")
        tenant_id = current_tenant_id(conn)
        saved = 0
        removed = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            seller_id = coerce_int(row.get("seller_id"), 0)
            seller = conn.execute(
                "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller'",
                (seller_id, tenant_id),
            ).fetchone()
            if not seller:
                continue
            sales_goal = nullable_float(row.get("sales_goal"))
            new_customers_goal = nullable_int(row.get("new_customers_goal"))
            positivation_goal = nullable_float(row.get("customer_positivation_goal"))
            if sales_goal is None and new_customers_goal is None and positivation_goal is None:
                cur = conn.execute(
                    "DELETE FROM seller_goals WHERE tenant_id = ? AND seller_id = ? AND year = ? AND month = ?",
                    (tenant_id, seller_id, year, month),
                )
                removed += cur.rowcount
                continue
            conn.execute(
                """
                INSERT INTO seller_goals
                    (tenant_id, seller_id, year, month, sales_goal, new_customers_goal, customer_positivation_goal, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(tenant_id, seller_id, year, month) DO UPDATE SET
                    sales_goal = excluded.sales_goal,
                    new_customers_goal = excluded.new_customers_goal,
                    customer_positivation_goal = excluded.customer_positivation_goal,
                    updated_at = excluded.updated_at
                """,
                (tenant_id, seller_id, year, month, sales_goal, new_customers_goal, positivation_goal, now_iso()),
            )
            saved += 1
        return {"message": f"Metas salvas. {saved} representante(s) atualizado(s).", "saved": saved, "removed": removed}
