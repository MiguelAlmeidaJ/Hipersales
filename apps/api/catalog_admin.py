from __future__ import annotations

"""Administração de catálogo, vínculos e usuários."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class CatalogAdminMixin:
    def admin_companies(self, conn: sqlite3.Connection, term: str = "", active: str = "all") -> list[dict[str, Any]]:
        tenant_id = current_tenant_id(conn)
        params: list[Any] = [tenant_id, tenant_id]
        sql = """
            SELECT c.*, COUNT(p.id) AS product_count
            FROM companies c
            LEFT JOIN products p ON p.company_id = c.id AND p.active = 1 AND p.tenant_id = ?
            WHERE c.tenant_id = ?
        """
        active_key = str(active or "all").strip().lower()
        if active_key in {"1", "true", "active", "ativo", "ativos"}:
            sql += " AND c.active = 1"
        elif active_key in {"0", "false", "inactive", "inativo", "inativos"}:
            sql += " AND c.active = 0"
        like = f"%{term.strip()}%"
        if term.strip():
            sql += " AND (c.name LIKE ? OR c.legal_name LIKE ?)"
            params.extend([like, like])
        sql += " GROUP BY c.id ORDER BY c.name"
        return [
            dict(row)
            for row in conn.execute(sql, params)
        ]

    def admin_customers(self, conn: sqlite3.Connection, term: str = "", active: str = "all") -> list[dict[str, Any]]:
        tenant_id = current_tenant_id(conn)
        params: list[Any] = [tenant_id]
        sql = """
            SELECT
                c.*,
                (
                    SELECT u.name
                    FROM customer_sellers cs
                    JOIN users u ON u.id = cs.seller_id
                    WHERE cs.customer_id = c.id
                    ORDER BY cs.seller_id
                    LIMIT 1
                ) AS seller_name,
                (
                    SELECT COALESCE(NULLIF(u.communication_email, ''), u.email)
                    FROM customer_sellers cs
                    JOIN users u ON u.id = cs.seller_id
                    WHERE cs.customer_id = c.id
                    ORDER BY cs.seller_id
                    LIMIT 1
                ) AS seller_email,
                (
                    SELECT COUNT(*)
                    FROM customer_sellers cs
                    WHERE cs.customer_id = c.id
                ) AS seller_count
                ,
                (
                    SELECT group_concat(u.name, ', ')
                    FROM customer_sellers cs
                    JOIN users u ON u.id = cs.seller_id
                    WHERE cs.customer_id = c.id
                ) AS seller_names
            FROM customers c
            WHERE c.tenant_id = ?
        """
        active_key = str(active or "all").strip().lower()
        if active_key in {"1", "true", "active", "ativo", "ativos"}:
            sql += " AND c.active = 1"
        elif active_key in {"0", "false", "inactive", "inativo", "inativos"}:
            sql += " AND c.active = 0"
        like = f"%{term.strip()}%"
        if term.strip():
            sql += " AND (c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ? OR c.phone LIKE ?)"
            params.extend([like, like, like, like])
        sql += " ORDER BY c.legal_name"
        customers = [dict(row) for row in conn.execute(sql, params)]
        for customer in customers:
            customer.update(enrich_customer_payload(customer))
        return customers

    def customer_by_cnpj(self, conn: sqlite3.Connection, cnpj: str, exclude_id: int | None = None) -> dict[str, Any] | None:
        digits = normalize_cnpj_digits(cnpj)
        if not digits:
            return None
        tenant_id = current_tenant_id(conn)
        for row in conn.execute(
            "SELECT id, legal_name, trade_name, cnpj, active FROM customers WHERE tenant_id = ?",
            (tenant_id,),
        ):
            if int(row["id"]) == int(exclude_id or 0):
                continue
            if normalize_cnpj_digits(row["cnpj"]) == digits:
                return dict(row)
        return None

    def admin_products(self, conn: sqlite3.Connection, company_id: str, term: str = "", active: str = "all") -> list[dict[str, Any]]:
        tenant_id = current_tenant_id(conn)
        params: list[Any] = [tenant_id]
        sql = """
            SELECT p.*, c.name AS company_name
            FROM products p
            JOIN companies c ON c.id = p.company_id AND c.tenant_id = p.tenant_id
            WHERE p.tenant_id = ?
        """
        if company_id not in ("", "0", None):
            sql += " AND p.company_id = ?"
            params.append(int(company_id))
        active_key = str(active or "all").strip().lower()
        if active_key in {"1", "true", "active", "ativo", "ativos"}:
            sql += " AND p.active = 1"
        elif active_key in {"0", "false", "inactive", "inativo", "inativos"}:
            sql += " AND p.active = 0"
        like = f"%{term.strip()}%"
        if term.strip():
            sql += " AND (p.code LIKE ? OR p.name LIKE ? OR c.name LIKE ?)"
            params.extend([like, like, like])
        sql += " ORDER BY c.name, p.code"
        return [dict(row) for row in conn.execute(sql, params)]

    def export_products_csv(self, conn: sqlite3.Connection, company_id: str, term: str, active: str) -> dict[str, Any]:
        rows = self.admin_products(conn, company_id, term, active)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["company_id", "company_name", "code", "name", "unit", "price", "active"])
        for row in rows:
            writer.writerow([
                row["company_id"],
                row["company_name"],
                row["code"],
                row["name"],
                row.get("unit") or "UN",
                row.get("price") or 0,
                1 if row.get("active") else 0,
            ])
        filename = f"produtos_filtrados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return {"filename": filename, "csv": buffer.getvalue()}

    def admin_requests(self, conn: sqlite3.Connection) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in conn.execute(
                """
                SELECT rr.*, u.name AS seller_name, COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
                       u.whatsapp_phone AS seller_whatsapp_phone
                FROM registration_requests rr
                JOIN users u ON u.id = rr.seller_id
                WHERE rr.tenant_id = ?
                ORDER BY rr.created_at DESC
                """,
                (current_tenant_id(conn),),
            )
        ]

    def admin_user_customers(self, conn: sqlite3.Connection, seller_id: int, term: str, active: str) -> dict[str, Any]:
        seller = user_row_or_error(conn, seller_id)
        tenant_id = current_tenant_id(conn)
        if seller["role"] != "seller" or int(seller["tenant_id"] or 0) != tenant_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial valido.")
        params: list[Any] = [seller_id, tenant_id]
        sql = """
            SELECT
                c.*,
                EXISTS(
                    SELECT 1
                    FROM customer_sellers cs
                    WHERE cs.customer_id = c.id AND cs.seller_id = ?
                ) AS assigned
            FROM customers c
            WHERE c.tenant_id = ?
        """
        active_key = str(active or "all").strip().lower()
        if active_key in {"1", "true", "active", "ativo", "ativos"}:
            sql += " AND c.active = 1"
        elif active_key in {"0", "false", "inactive", "inativo", "inativos"}:
            sql += " AND c.active = 0"
        like = f"%{term.strip()}%"
        if term.strip():
            sql += " AND " if " WHERE " in sql else " WHERE "
            sql += " (c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ?)"
            params.extend([like, like, like])
        sql += " ORDER BY c.legal_name"
        customers = [dict(row) for row in conn.execute(sql, params)]
        for customer in customers:
            customer["assigned"] = coerce_bool(customer.get("assigned"))
        return {
            "seller": public_user_payload(seller),
            "customers": customers,
            "assigned_count": sum(1 for customer in customers if customer["assigned"]),
        }

    def admin_user_companies(self, conn: sqlite3.Connection, seller_id: int, term: str, active: str) -> dict[str, Any]:
        seller = user_row_or_error(conn, seller_id)
        tenant_id = current_tenant_id(conn)
        if seller["role"] != "seller" or int(seller["tenant_id"] or 0) != tenant_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial valido.")
        params: list[Any] = [seller_id, tenant_id]
        sql = """
            SELECT
                c.*,
                EXISTS(
                    SELECT 1
                    FROM company_sellers cs
                    WHERE cs.company_id = c.id AND cs.seller_id = ?
                ) AS assigned
            FROM companies c
            WHERE c.tenant_id = ?
        """
        active_key = str(active or "all").strip().lower()
        if active_key in {"1", "true", "active", "ativo", "ativos"}:
            sql += " AND c.active = 1"
        elif active_key in {"0", "false", "inactive", "inativo", "inativos"}:
            sql += " AND c.active = 0"
        like = f"%{term.strip()}%"
        if term.strip():
            sql += " AND (c.name LIKE ? OR c.legal_name LIKE ?)"
            params.extend([like, like])
        sql += " ORDER BY c.name"
        companies = [dict(row) for row in conn.execute(sql, params)]
        for company in companies:
            company["assigned"] = coerce_bool(company.get("assigned"))
        return {
            "seller": public_user_payload(seller),
            "companies": companies,
            "assigned_count": sum(1 for company in companies if company["assigned"]),
        }

    def admin_outbox(self, conn: sqlite3.Connection) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM email_outbox
                WHERE tenant_id = ?
                ORDER BY id DESC
                LIMIT 20
                """,
                (current_tenant_id(conn),),
            )
        ]

    def create_company(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["name"])
        tenant_id = current_tenant_id(conn)
        try:
            cur = conn.execute(
                "INSERT INTO companies (tenant_id, name, legal_name, active) VALUES (?, ?, ?, ?)",
                (tenant_id, data["name"], data.get("legal_name"), 1 if data.get("active", True) else 0),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Nao foi possivel cadastrar a empresa.") from exc
        return {"id": cur.lastrowid, "message": "Empresa cadastrada."}

    def update_company(self, conn: sqlite3.Connection, company_id: int, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["name"])
        tenant_id = current_tenant_id(conn)
        active = 1 if data.get("active", True) else 0
        try:
            cur = conn.execute(
                """
                UPDATE companies
                SET name = ?, legal_name = ?, active = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (data["name"], data.get("legal_name"), active, company_id, tenant_id),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Nao foi possivel atualizar a empresa.") from exc
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Empresa nao encontrada.")
        return {"id": company_id, "message": "Empresa atualizada."}

    def delete_company(self, conn: sqlite3.Connection, company_id: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        company = conn.execute("SELECT id, name FROM companies WHERE id = ? AND tenant_id = ?", (company_id, tenant_id)).fetchone()
        if not company:
            raise ApiError(HTTPStatus.NOT_FOUND, "Empresa nao encontrada.")

        proposals = conn.execute("SELECT id FROM proposals WHERE company_id = ? AND tenant_id = ?", (company_id, tenant_id)).fetchall()
        if proposals:
            proposal_ids = [int(row["id"]) for row in proposals]
            placeholder = ",".join("?" for _ in proposal_ids)
            conn.execute(
                f"DELETE FROM proposal_items WHERE proposal_id IN ({placeholder})",
                proposal_ids,
            )
            conn.execute(
                f"DELETE FROM proposal_events WHERE proposal_id IN ({placeholder})",
                proposal_ids,
            )
            conn.execute(
                f"DELETE FROM proposals WHERE id IN ({placeholder})",
                proposal_ids,
            )

        conn.execute("DELETE FROM products WHERE company_id = ? AND tenant_id = ?", (company_id, tenant_id))
        conn.execute("DELETE FROM companies WHERE id = ? AND tenant_id = ?", (company_id, tenant_id))
        return {"message": "Empresa excluida definitivamente."}

    def create_product(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["company_id", "code", "name"])
        tenant_id = current_tenant_id(conn)
        company_id = int(data["company_id"])
        company = conn.execute("SELECT id FROM companies WHERE id = ? AND tenant_id = ?", (company_id, tenant_id)).fetchone()
        if not company:
            raise ApiError(HTTPStatus.NOT_FOUND, "Empresa nao encontrada.")
        code = str(data["code"]).strip()
        name = str(data["name"]).strip()
        unit = str(data.get("unit") or "UN").strip() or "UN"
        price = float(data.get("price") or 0)
        active = 1 if data.get("active", True) else 0
        try:
            cur = conn.execute(
                """
                INSERT INTO products
                    (tenant_id, company_id, code, name, unit, price, active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(company_id, code) DO UPDATE SET
                    name = excluded.name,
                    unit = excluded.unit,
                    price = excluded.price,
                    active = excluded.active
                """,
                (
                    tenant_id,
                    company_id,
                    code,
                    name,
                    unit,
                    price,
                    active,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Nao foi possivel cadastrar o produto.") from exc
        return {"id": cur.lastrowid, "message": "Produto salvo."}

    def update_product(self, conn: sqlite3.Connection, product_id: int, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["company_id", "code", "name"])
        tenant_id = current_tenant_id(conn)
        company_id = int(data["company_id"])
        company = conn.execute("SELECT id FROM companies WHERE id = ? AND tenant_id = ?", (company_id, tenant_id)).fetchone()
        if not company:
            raise ApiError(HTTPStatus.NOT_FOUND, "Empresa nao encontrada.")
        code = str(data["code"]).strip()
        name = str(data["name"]).strip()
        unit = str(data.get("unit") or "UN").strip() or "UN"
        price = float(data.get("price") or 0)
        active = 1 if data.get("active", True) else 0
        try:
            cur = conn.execute(
                """
                UPDATE products
                SET company_id = ?, code = ?, name = ?, unit = ?, price = ?, active = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (company_id, code, name, unit, price, active, product_id, tenant_id),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Ja existe um produto com esse codigo nesse fornecedor.") from exc
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Produto nao encontrado.")
        return {"id": product_id, "message": "Produto atualizado."}

    def delete_product(self, conn: sqlite3.Connection, product_id: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        product = conn.execute("SELECT id FROM products WHERE id = ? AND tenant_id = ?", (product_id, tenant_id)).fetchone()
        if not product:
            raise ApiError(HTTPStatus.NOT_FOUND, "Produto nao encontrado.")
        used = conn.execute("SELECT 1 FROM proposal_items WHERE product_id = ? LIMIT 1", (product_id,)).fetchone()
        if used:
            raise ApiError(HTTPStatus.CONFLICT, "Produto ja usado em pedido. Inative o produto para preservar o historico.")
        cur = conn.execute("DELETE FROM products WHERE id = ? AND tenant_id = ?", (product_id, tenant_id))
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Produto nao encontrado.")
        return {"message": "Produto excluido."}

    def import_products(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        rows = data.get("rows")
        if not isinstance(rows, list) or not rows:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Nenhum item para importar.")

        created = 0
        updated = 0
        tenant_id = current_tenant_id(conn)
        for raw_row in rows:
            if not isinstance(raw_row, dict):
                continue
            required(raw_row, ["company_id", "code", "name"])
            company_id = int(raw_row["company_id"])
            company = conn.execute("SELECT id FROM companies WHERE id = ? AND tenant_id = ?", (company_id, tenant_id)).fetchone()
            if not company:
                continue
            code = str(raw_row["code"]).strip()
            name = str(raw_row["name"]).strip()
            unit = str(raw_row.get("unit") or "UN").strip() or "UN"
            price = float(raw_row.get("price") or 0)
            active = 1 if coerce_bool(raw_row.get("active", True)) else 0
            existing = conn.execute(
                "SELECT id FROM products WHERE tenant_id = ? AND company_id = ? AND code = ?",
                (tenant_id, company_id, code),
            ).fetchone()
            conn.execute(
                """
                INSERT INTO products
                    (tenant_id, company_id, code, name, unit, price, active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(company_id, code) DO UPDATE SET
                    name = excluded.name,
                    unit = excluded.unit,
                    price = excluded.price,
                    active = excluded.active
                """,
                (tenant_id, company_id, code, name, unit, price, active),
            )
            if existing:
                updated += 1
            else:
                created += 1
        return {"message": "Importacao concluida.", "created": created, "updated": updated}

    def create_user(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["name", "email", "role"])
        role = str(data["role"]).strip()
        if role not in {"admin", "seller"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Perfil de usuario invalido.")
        name = str(data["name"]).strip()
        email = normalize_username(data["email"])
        communication_email = str(data.get("communication_email") or "").strip().lower()
        whatsapp_phone = normalize_user_whatsapp_phone(data.get("whatsapp_phone"))
        if not email:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe o usuario.")
        password = str(data.get("password") or "").strip()
        temporary_password = str(data.get("temporary_password") or "").strip()
        if temporary_password:
            password = temporary_password
            must_change_password = 1
        elif not password:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe a senha ou a senha temporaria.")
        else:
            must_change_password = 0
        try:
            cur = conn.execute(
                """
                INSERT INTO users (tenant_id, name, email, communication_email, whatsapp_phone, password_hash, role, active, must_change_password, password_updated_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    current_tenant_id(conn),
                    name,
                    email,
                    communication_email,
                    whatsapp_phone,
                    hash_password(password),
                    role,
                    1 if data.get("active", True) else 0,
                    must_change_password,
                    now_iso(),
                    now_iso(),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Este usuario ja esta em uso.") from exc
        response: dict[str, Any] = {
            "id": cur.lastrowid,
            "message": "Usuario cadastrado.",
            "user": public_user_payload(user_row_or_error(conn, cur.lastrowid)),
        }
        return response

    def set_customer_assignment(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["customer_id", "seller_id", "assigned"])
        customer_id = int(data["customer_id"])
        seller_id = int(data["seller_id"])
        assigned = coerce_bool(data["assigned"])
        seller = user_row_or_error(conn, seller_id)
        tenant_id = current_tenant_id(conn)
        if seller["role"] != "seller" or int(seller["tenant_id"] or 0) != tenant_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial valido.")
        customer_exists = conn.execute("SELECT id FROM customers WHERE id = ? AND tenant_id = ?", (customer_id, tenant_id)).fetchone()
        if not customer_exists:
            raise ApiError(HTTPStatus.NOT_FOUND, "Cliente nao encontrado.")
        if assigned:
            conn.execute(
                "INSERT OR IGNORE INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)",
                (customer_id, seller_id),
            )
            message = "Cliente associado ao representante comercial."
        else:
            conn.execute(
                "DELETE FROM customer_sellers WHERE customer_id = ? AND seller_id = ?",
                (customer_id, seller_id),
            )
            message = "Cliente desvinculado do representante comercial."
        return {"message": message}

    def set_company_assignment(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["company_id", "seller_id", "assigned"])
        company_id = int(data["company_id"])
        seller_id = int(data["seller_id"])
        assigned = coerce_bool(data["assigned"])
        seller = user_row_or_error(conn, seller_id)
        tenant_id = current_tenant_id(conn)
        if seller["role"] != "seller" or int(seller["tenant_id"] or 0) != tenant_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial valido.")
        company = conn.execute(
            "SELECT id FROM companies WHERE id = ? AND tenant_id = ?",
            (company_id, tenant_id),
        ).fetchone()
        if not company:
            raise ApiError(HTTPStatus.NOT_FOUND, "Empresa nao encontrada.")
        if assigned:
            conn.execute(
                "INSERT OR IGNORE INTO company_sellers (company_id, seller_id) VALUES (?, ?)",
                (company_id, seller_id),
            )
            message = "Empresa associada ao representante comercial."
        else:
            conn.execute(
                "DELETE FROM company_sellers WHERE company_id = ? AND seller_id = ?",
                (company_id, seller_id),
            )
            message = "Empresa desvinculada do representante comercial."
        return {"message": message}

    def update_user(self, conn: sqlite3.Connection, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        row = user_row_or_error(conn, user_id)
        if coerce_bool(row["is_super_admin"]) or int(row["tenant_id"] or 0) != current_tenant_id(conn):
            raise ApiError(HTTPStatus.NOT_FOUND, "Usuario nao encontrado.")
        name = str(data.get("name", row["name"])).strip() or row["name"]
        email = normalize_username(data.get("email", row["email"])) or row["email"]
        communication_email = str(data.get("communication_email", row["communication_email"] or "") or "").strip().lower()
        whatsapp_phone = normalize_user_whatsapp_phone(data.get("whatsapp_phone", row["whatsapp_phone"] or ""))
        role = str(data.get("role", row["role"])).strip() or row["role"]
        if role not in {"admin", "seller"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Perfil de usuario invalido.")
        active = 1 if coerce_bool(data.get("active", row["active"])) else 0
        temporary_password = str(data.get("temporary_password") or "").strip()
        password = str(data.get("password") or "").strip()
        force_password_change = coerce_bool(data.get("must_change_password", False))
        if temporary_password:
            password = temporary_password
            force_password_change = 1
        elif password:
            force_password_change = 0 if not force_password_change else 1
        update_password = bool(password)

        assignments = ["name = ?", "email = ?", "communication_email = ?", "whatsapp_phone = ?", "role = ?", "active = ?", "must_change_password = ?"]
        params: list[Any] = [name, email, communication_email, whatsapp_phone, role, active, 1 if force_password_change else 0]
        if update_password:
            assignments.append("password_hash = ?")
            params.append(hash_password(password))
            assignments.append("password_updated_at = ?")
            params.append(now_iso())
        params.append(user_id)
        try:
            conn.execute(
                f"""
                UPDATE users
                SET {", ".join(assignments)}
                WHERE id = ?
                """,
                params,
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Este usuario ja esta em uso.") from exc
        response: dict[str, Any] = {
            "message": "Usuario atualizado.",
            "user": public_user_payload(user_row_or_error(conn, user_id)),
        }
        return response

    def change_own_password(self, conn: sqlite3.Connection, user: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        new_password = str(data.get("new_password") or "").strip()
        if len(new_password) < 8:
            raise ApiError(HTTPStatus.BAD_REQUEST, "A nova senha precisa ter pelo menos 8 caracteres.")

        row = user_row_or_error(conn, int(user["id"]))
        if not coerce_bool(row["must_change_password"]):
            current_password = str(data.get("current_password") or "").strip()
            if not current_password or not verify_password(current_password, row["password_hash"]):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Senha atual invalida.")

        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, must_change_password = 0, password_updated_at = ?
            WHERE id = ?
            """,
            (hash_password(new_password), now_iso(), row["id"]),
        )
        return {
            "message": "Senha atualizada com sucesso.",
            "user": public_user_payload(user_row_or_error(conn, int(user["id"]))),
        }
