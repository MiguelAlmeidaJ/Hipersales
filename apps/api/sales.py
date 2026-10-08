from __future__ import annotations

"""Consultas comerciais, propostas, ocorrências e seus PDFs."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class SalesMixin:
    def customers(self, conn: sqlite3.Connection, user: dict[str, Any], term: str) -> list[dict[str, Any]]:
        like = f"%{term.strip()}%"
        tenant_id = current_tenant_id(conn)
        params: list[Any] = [tenant_id, like, like, like]
        sql = """
            SELECT c.*
            FROM customers c
        """
        if user["role"] != "admin":
            sql += " JOIN customer_sellers cs ON cs.customer_id = c.id AND cs.seller_id = ?"
            params = [user["id"], tenant_id, like, like, like]
        sql += """
            WHERE c.tenant_id = ? AND c.active = 1 AND (c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ?)
            ORDER BY c.legal_name
        """
        return [enrich_customer_payload(dict(row)) for row in conn.execute(sql, params)]

    def companies(self, conn: sqlite3.Connection, user: dict[str, Any]) -> list[dict[str, Any]]:
        tenant_id = current_tenant_id(conn)
        if user["role"] == "admin":
            rows = conn.execute(
                "SELECT * FROM companies WHERE active = 1 AND tenant_id = ? ORDER BY name",
                (tenant_id,),
            )
        else:
            rows = conn.execute(
                """
                SELECT c.*
                FROM companies c
                JOIN company_sellers cs ON cs.company_id = c.id AND cs.seller_id = ?
                WHERE c.active = 1 AND c.tenant_id = ?
                ORDER BY c.name
                """,
                (user["id"], tenant_id),
            )
        return [dict(row) for row in rows]

    def products(self, conn: sqlite3.Connection, user: dict[str, Any], company_id: int, term: str) -> list[dict[str, Any]]:
        if user["role"] != "admin":
            allowed = conn.execute(
                "SELECT 1 FROM company_sellers WHERE company_id = ? AND seller_id = ?",
                (company_id, user["id"]),
            ).fetchone()
            if not allowed:
                raise ApiError(HTTPStatus.FORBIDDEN, "Empresa nao associada ao representante comercial.")
        like = f"%{term.strip()}%"
        return [
            dict(row)
            for row in conn.execute(
                """
                SELECT * FROM products
                WHERE active = 1 AND tenant_id = ? AND company_id = ? AND (code LIKE ? OR name LIKE ?)
                ORDER BY code
                """,
                (current_tenant_id(conn), company_id, like, like),
            )
        ]

    def create_customer_request(self, conn: sqlite3.Connection, user: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        if user["role"] != "seller":
            raise ApiError(HTTPStatus.FORBIDDEN, "Solicitacao de cadastro disponivel apenas para representantes comerciais.")
        required(data, ["legal_name", "cnpj", "contact_person", "phone_1"])
        digits = normalize_cnpj_digits(data["cnpj"])
        existing_customer = self.customer_by_cnpj(conn, digits)
        if existing_customer:
            raise ApiError(HTTPStatus.CONFLICT, "Ja existe esse CNPJ na nossa base.")
        lookup = self.lookup_cnpj(conn, digits)
        seller_contact_email = first_text(user.get("communication_email"), data.get("representative_email"), user.get("email"))
        data = {
            **data,
            "representative_name": user.get("name") or data.get("representative_name"),
            "representative_email": seller_contact_email,
        }
        payload = {**data, "_lookup": lookup}
        form_payload = json.dumps(payload, ensure_ascii=False)
        legal_name = first_text(data.get("legal_name"), lookup.get("legal_name"))
        trade_name = first_text(data.get("trade_name"), lookup.get("trade_name"))
        state_registration = first_text(data.get("state_registration"), lookup.get("state_registration"))
        address = first_text(build_customer_address_from_payload(data), lookup.get("address"))
        phone = first_text(data.get("phone_1"), lookup.get("phone"))
        email = first_text(data.get("purchase_email"), data.get("billing_email"), data.get("xml_email"), lookup.get("email"))
        notes = first_text(data.get("delivery_warnings"), data.get("notes"))
        cur = conn.execute(
            """
            INSERT INTO registration_requests
                (tenant_id, seller_id, legal_name, trade_name, cnpj, state_registration, address, phone, email, notes, form_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_tenant_id(conn),
                user["id"],
                legal_name,
                trade_name,
                data["cnpj"],
                state_registration,
                address,
                phone,
                email,
                notes,
                form_payload,
                now_iso(),
            ),
        )
        body = format_registration_email(user, data)
        subject = f"SOLICITACAO DE CADASTRO {legal_name}"
        conn.execute(
            "INSERT INTO email_outbox (tenant_id, kind, recipients, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (current_tenant_id(conn), "customer_request", "vendas@hipermixrepresentacoes.com.br,thallesmachadocomercial@gmail.com", subject, body, now_iso()),
        )
        return {"id": cur.lastrowid, "message": "Solicitacao enviada para o back office."}

    def create_proposal(self, conn: sqlite3.Connection, user: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        is_admin = user["role"] == "admin"
        if user["role"] not in {"seller", "admin"}:
            raise ApiError(HTTPStatus.FORBIDDEN, "Envio de proposta indisponivel para este usuario.")
        required(data, ["company_id", "customer_id", "order_type", "freight_type", "delivery_type", "items"])
        order_type = str(data.get("order_type") or "").strip()
        is_bonus = is_bonus_order_type(order_type)
        payment_terms = "" if is_bonus else str(data.get("payment_terms") or "").strip()
        commission_percent = 0.0 if is_bonus else parse_percentage_value(data.get("commission_percent"))
        discount_percent = 0.0 if is_bonus else parse_percentage_value(data.get("discount_percent"))
        discount_on = "Sem descontos" if is_bonus else normalize_discount_on(data.get("discount_on"))
        tax_operator_invoice = 1 if coerce_bool(data.get("tax_operator_invoice", False)) else 0
        if not is_bonus and not payment_terms:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe a forma de pagamento.")
        if not data["items"]:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Inclua ao menos um produto na proposta.")
        if not conn.execute("SELECT 1 FROM companies WHERE id = ? AND tenant_id = ? AND active = 1", (data["company_id"], tenant_id)).fetchone():
            raise ApiError(HTTPStatus.BAD_REQUEST, "Empresa invalida para esta conta.")
        if not conn.execute("SELECT 1 FROM customers WHERE id = ? AND tenant_id = ? AND active = 1", (data["customer_id"], tenant_id)).fetchone():
            raise ApiError(HTTPStatus.BAD_REQUEST, "Cliente invalido para esta conta.")
        seller_id = int(data.get("seller_id") or user["id"])
        if is_admin:
            seller = conn.execute("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller' AND active = 1", (seller_id, tenant_id)).fetchone()
            if not seller:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial ativo para criar o pedido.")
            company_allowed = conn.execute(
                "SELECT 1 FROM company_sellers WHERE company_id = ? AND seller_id = ?",
                (data["company_id"], seller_id),
            ).fetchone()
            if not company_allowed:
                raise ApiError(HTTPStatus.FORBIDDEN, "Empresa nao associada ao representante comercial.")
            conn.execute(
                "INSERT OR IGNORE INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)",
                (data["customer_id"], seller_id),
            )
        else:
            if seller_id != int(user["id"]):
                raise ApiError(HTTPStatus.FORBIDDEN, "Representante comercial invalido para esta proposta.")
            company_allowed = conn.execute(
                "SELECT 1 FROM company_sellers WHERE company_id = ? AND seller_id = ?",
                (data["company_id"], seller_id),
            ).fetchone()
            if not company_allowed:
                raise ApiError(HTTPStatus.FORBIDDEN, "Empresa nao associada ao representante comercial.")
            allowed = conn.execute(
                "SELECT 1 FROM customer_sellers WHERE customer_id = ? AND seller_id = ?",
                (data["customer_id"], seller_id),
            ).fetchone()
            if not allowed:
                raise ApiError(HTTPStatus.FORBIDDEN, "Cliente nao associado ao representante comercial.")
        order_number = self.next_order_number(conn)
        cur = conn.execute(
            """
            INSERT INTO proposals
                (tenant_id, order_number, seller_id, company_id, customer_id, order_type, purchase_order, commission_percent, invoice_type,
                 tax_operator_invoice, freight_type, delivery_type, scheduled_delivery_date, discount_percent, discount_on,
                 payment_terms, notes, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                order_number,
                seller_id,
                data["company_id"],
                data["customer_id"],
                order_type,
                data.get("purchase_order"),
                commission_percent,
                data.get("invoice_type") or "Com nota cheia",
                tax_operator_invoice,
                data["freight_type"],
                data["delivery_type"],
                data.get("scheduled_delivery_date") if data["delivery_type"] == "Entrega Programada" else None,
                discount_percent,
                discount_on,
                payment_terms,
                data.get("notes"),
                "em_analise",
                now_iso(),
                now_iso(),
            ),
        )
        proposal_id = cur.lastrowid
        for item in data["items"]:
            required(item, ["product_id", "quantity", "negotiated_price"])
            product = conn.execute(
                "SELECT id FROM products WHERE id = ? AND tenant_id = ? AND company_id = ? AND active = 1",
                (item["product_id"], tenant_id, data["company_id"]),
            ).fetchone()
            if not product:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Produto invalido para a empresa selecionada.")
            conn.execute(
                "INSERT INTO proposal_items (proposal_id, product_id, quantity, negotiated_price) VALUES (?, ?, ?, ?)",
                (proposal_id, item["product_id"], float(item["quantity"]), float(item["negotiated_price"])),
            )
        conn.execute(
            """
            INSERT INTO proposal_events (proposal_id, status, title, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (proposal_id, "em_analise", STATUS_LABELS["em_analise"], "Proposta enviada para analise.", seller_id, now_iso()),
        )
        body = format_new_proposal_email(conn, proposal_id)
        subject = format_proposal_subject(conn, proposal_id, "NOVA PROPOSTA")
        recipients = "thallesmachadocomercial@gmail.com"
        queue_outbox(conn, "new_proposal_admin", recipients, subject, body)
        message = "Pedido criado pelo admin." if is_admin else "Proposta enviada para analise."
        return {
            "id": proposal_id,
            "order_number": order_number,
            "status": "em_analise",
            "company_id": int(data["company_id"]),
            "customer_id": int(data["customer_id"]),
            "message": message,
        }

    def next_order_number(self, conn: sqlite3.Connection) -> int:
        row = conn.execute("SELECT COALESCE(MAX(order_number), 10839) + 1 AS next_number FROM proposals WHERE tenant_id = ?", (current_tenant_id(conn),)).fetchone()
        return int(row["next_number"] or 10840)

    def proposals(self, conn: sqlite3.Connection, user: dict[str, Any]) -> list[dict[str, Any]]:
        params: list[Any] = [current_tenant_id(conn)]
        sql = """
            SELECT p.*, u.name AS seller_name,
                   COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
                   u.whatsapp_phone AS seller_whatsapp_phone,
                   c.legal_name AS customer_name, c.trade_name AS customer_trade_name,
                   c.cnpj AS customer_cnpj, c.state_registration AS customer_state_registration,
                   c.address AS customer_address, c.phone AS customer_phone, c.email AS customer_email,
                   co.name AS company_name
            FROM proposals p
            JOIN users u ON u.id = p.seller_id
            JOIN customers c ON c.id = p.customer_id
            JOIN companies co ON co.id = p.company_id
            WHERE p.tenant_id = ?
        """
        if user["role"] != "admin":
            sql += " AND p.seller_id = ?"
            params.append(user["id"])
        sql += " ORDER BY p.created_at DESC"
        proposals = [dict(row) for row in conn.execute(sql, params)]
        for proposal in proposals:
            proposal["items"] = [
                dict(row)
                for row in conn.execute(
                    """
                    SELECT pi.*, pr.code, pr.name, pr.unit
                    FROM proposal_items pi
                    JOIN products pr ON pr.id = pi.product_id
                    WHERE pi.proposal_id = ?
                    ORDER BY pi.id
                    """,
                    (proposal["id"],),
                )
            ]
            proposal["timeline"] = normalize_timeline_events([
                dict(row)
                for row in conn.execute(
                    """
                    SELECT pe.*, u.name AS created_by_name
                    FROM proposal_events pe
                    LEFT JOIN users u ON u.id = pe.created_by
                    WHERE pe.proposal_id = ?
                    ORDER BY pe.created_at, pe.id
                    """,
                    (proposal["id"],),
                )
            ])
        return proposals

    def occurrences(self, conn: sqlite3.Connection, user: dict[str, Any]) -> list[dict[str, Any]]:
        self.cleanup_old_occurrence_attachments(conn)
        params: list[Any] = [current_tenant_id(conn)]
        sql = """
            SELECT o.*,
                   u.name AS seller_name,
                   COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
                   c.legal_name AS customer_name,
                   c.trade_name AS customer_trade_name,
                   c.cnpj AS customer_cnpj,
                   c.state_registration AS customer_state_registration,
                   c.address AS customer_address,
                   c.phone AS customer_phone,
                   c.email AS customer_email
            FROM occurrences o
            JOIN users u ON u.id = o.seller_id
            JOIN customers c ON c.id = o.customer_id
            WHERE o.tenant_id = ?
        """
        if user["role"] != "admin":
            sql += " AND o.seller_id = ?"
            params.append(user["id"])
        sql += " ORDER BY o.created_at DESC, o.id DESC"
        rows = []
        for row in conn.execute(sql, params).fetchall():
            item = dict(row)
            item["attachment_names"] = safe_json_loads(item.get("attachment_names"), [])
            item["attachments"] = [
                dict(attachment)
                for attachment in conn.execute(
                    """
                    SELECT id, filename, mimetype, created_at
                    FROM occurrence_attachments
                    WHERE occurrence_id = ? AND tenant_id = ?
                    ORDER BY id
                    """,
                    (item["id"], current_tenant_id(conn)),
                ).fetchall()
            ]
            item["attachments_expired"] = bool(item["attachment_names"] and not item["attachments"] and normalize_occurrence_status(item.get("status")) == "solucionada")
            item["timeline"] = self.occurrence_timeline(conn, item)
            rows.append(item)
        return rows

    def cleanup_old_occurrence_attachments(self, conn: sqlite3.Connection) -> None:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        conn.execute(
            """
            DELETE FROM occurrence_attachments
            WHERE occurrence_id IN (
                SELECT id
                FROM occurrences
                WHERE tenant_id = ?
                  AND status IN ('solucionada', 'solucionado', 'tratada', 'encerrada')
                  AND resolved_at IS NOT NULL
                  AND resolved_at <= ?
            )
            """,
            (current_tenant_id(conn), cutoff),
        )

    def occurrence_timeline(self, conn: sqlite3.Connection, occurrence: dict[str, Any]) -> list[dict[str, Any]]:
        events = [
            dict(row)
            for row in conn.execute(
                """
                SELECT oe.*, u.name AS created_by_name
                FROM occurrence_events oe
                LEFT JOIN users u ON u.id = oe.created_by
                WHERE oe.occurrence_id = ? AND oe.tenant_id = ?
                ORDER BY oe.created_at, oe.id
                """,
                (occurrence["id"], current_tenant_id(conn)),
            ).fetchall()
        ]
        if events:
            return events
        timeline = [
            {
                "id": 0,
                "occurrence_id": occurrence.get("id"),
                "status": "aberta",
                "title": "Ocorrencia aberta",
                "notes": "Registro enviado e aguardando verificacao da retaguarda.",
                "created_by_name": occurrence.get("seller_name"),
                "created_at": occurrence.get("created_at"),
            }
        ]
        current_status = normalize_occurrence_status(occurrence.get("status"))
        if current_status != "aberta" or occurrence.get("updated_at") != occurrence.get("created_at"):
            timeline.append(
                {
                    "id": 0,
                    "occurrence_id": occurrence.get("id"),
                    "status": current_status,
                    "title": occurrence_status_label(current_status),
                    "notes": occurrence.get("resolution") or "Status atualizado pela retaguarda.",
                    "created_by_name": "Retaguarda",
                    "created_at": occurrence.get("updated_at") or occurrence.get("created_at"),
                }
            )
        return timeline

    def send_occurrence_attachment(
        self,
        conn: sqlite3.Connection,
        user: dict[str, Any],
        occurrence_id: int,
        attachment_id: int,
    ) -> None:
        tenant_id = current_tenant_id(conn)
        row = conn.execute(
            """
            SELECT oa.filename, oa.mimetype, oa.content, o.seller_id
            FROM occurrence_attachments oa
            JOIN occurrences o ON o.id = oa.occurrence_id
            WHERE oa.id = ? AND oa.occurrence_id = ? AND oa.tenant_id = ?
            """,
            (attachment_id, occurrence_id, tenant_id),
        ).fetchone()
        if not row:
            raise ApiError(HTTPStatus.NOT_FOUND, "Anexo nao encontrado.")
        if user["role"] != "admin" and int(row["seller_id"]) != int(user["id"]):
            raise ApiError(HTTPStatus.FORBIDDEN, "Voce nao tem acesso a este anexo.")
        self.send_file_bytes(row["filename"], row["mimetype"], row["content"])

    def create_occurrence(self, conn: sqlite3.Connection, user: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        if user["role"] not in {"seller", "admin"}:
            raise ApiError(HTTPStatus.FORBIDDEN, "Registro de ocorrencia indisponivel para este usuario.")
        required(data, ["customer_id", "reason", "description"])
        tenant_id = current_tenant_id(conn)
        seller_id = int(data.get("seller_id") or user["id"])
        if user["role"] == "admin":
            seller = conn.execute(
                "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller' AND active = 1",
                (seller_id, tenant_id),
            ).fetchone()
            if not seller:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Selecione um representante comercial ativo.")
        elif seller_id != int(user["id"]):
            raise ApiError(HTTPStatus.FORBIDDEN, "Representante comercial invalido para esta ocorrencia.")
        customer = conn.execute(
            """
            SELECT c.*
            FROM customers c
            WHERE c.id = ? AND c.tenant_id = ? AND c.active = 1
            """,
            (data["customer_id"], tenant_id),
        ).fetchone()
        if not customer:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Cliente invalido para esta conta.")
        if user["role"] != "admin":
            allowed = conn.execute(
                "SELECT 1 FROM customer_sellers WHERE customer_id = ? AND seller_id = ?",
                (data["customer_id"], seller_id),
            ).fetchone()
            if not allowed:
                raise ApiError(HTTPStatus.FORBIDDEN, "Cliente nao associado ao representante comercial.")
        seller = conn.execute(
            "SELECT name, email, communication_email FROM users WHERE id = ? AND tenant_id = ?",
            (seller_id, tenant_id),
        ).fetchone()
        reason = str(data.get("reason") or "").strip()
        description = str(data.get("description") or "").strip()
        if not reason:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe o motivo da ocorrencia.")
        if not description:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Relate o ocorrido.")
        attachment_names: list[str] = []
        email_attachments: list[dict[str, Any]] = []
        total_attachment_bytes = 0
        for attachment in data.get("attachments") or []:
            filename = str(attachment.get("filename") or "anexo").strip()[:140] or "anexo"
            mimetype = str(attachment.get("mimetype") or "application/octet-stream").strip() or "application/octet-stream"
            content_raw = str(attachment.get("content") or "")
            if "," in content_raw and content_raw.startswith("data:"):
                content_raw = content_raw.split(",", 1)[1]
            try:
                content = base64.b64decode(content_raw, validate=True)
            except Exception:
                raise ApiError(HTTPStatus.BAD_REQUEST, f"Anexo invalido: {filename}")
            total_attachment_bytes += len(content)
            if total_attachment_bytes > 25 * 1024 * 1024:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Os anexos ultrapassam 25 MB. Envie arquivos menores.")
            attachment_names.append(filename)
            email_attachments.append({"filename": filename, "mimetype": mimetype, "content": content})
        timestamp = now_iso()
        cur = conn.execute(
            """
            INSERT INTO occurrences
                (tenant_id, seller_id, customer_id, reason, description, attachment_names, status, resolution, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                seller_id,
                data["customer_id"],
                reason,
                description,
                json.dumps(attachment_names, ensure_ascii=False),
                "aberta",
                "",
                timestamp,
                timestamp,
            ),
        )
        occurrence_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO occurrence_events
                (occurrence_id, tenant_id, status, title, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                occurrence_id,
                tenant_id,
                "aberta",
                "Ocorrencia aberta",
                "Registro enviado e aguardando verificacao da retaguarda.",
                seller_id,
                timestamp,
            ),
        )
        for attachment in email_attachments:
            conn.execute(
                """
                INSERT INTO occurrence_attachments
                    (occurrence_id, tenant_id, filename, mimetype, content, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    occurrence_id,
                    tenant_id,
                    attachment["filename"],
                    attachment["mimetype"],
                    attachment["content"],
                    timestamp,
                ),
            )
        seller_email = first_text(seller["communication_email"] if seller else "", seller["email"] if seller else "")
        customer_dict = dict(customer)
        body = "\n".join(
            [
                f"Nova ocorrencia registrada no HiperSales Web.",
                "",
                f"Ocorrencia: #{occurrence_id}",
                f"Representante comercial: {seller['name'] if seller else user.get('name', '')}",
                f"E-mail do representante: {seller_email or '-'}",
                f"Cliente: {customer_dict.get('legal_name') or '-'}",
                f"Nome fantasia: {customer_dict.get('trade_name') or '-'}",
                f"CNPJ: {customer_dict.get('cnpj') or '-'}",
                f"Inscricao estadual: {customer_dict.get('state_registration') or '-'}",
                f"Endereco: {customer_dict.get('address') or '-'}",
                f"Telefone: {customer_dict.get('phone') or '-'}",
                f"E-mail cliente: {customer_dict.get('email') or '-'}",
                "",
                f"Motivo: {reason}",
                "",
                "Relato:",
                description,
                "",
                f"Anexos: {', '.join(attachment_names) if attachment_names else 'Sem anexos.'}",
            ]
        )
        send_email_message(
            conn,
            "occurrence_created",
            "vendas@hipermixrepresentacoes.com.br,thallesmachadocomercial@gmail.com",
            f"NOVA OCORRENCIA {customer_dict.get('legal_name') or ''} {customer_dict.get('cnpj') or ''}".strip(),
            body,
            email_attachments,
        )
        return {"id": occurrence_id, "message": "Ocorrencia registrada e enviada para analise."}

    def update_occurrence(self, conn: sqlite3.Connection, occurrence_id: int, data: dict[str, Any]) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        previous = conn.execute(
            "SELECT status, resolution, resolved_at FROM occurrences WHERE id = ? AND tenant_id = ?",
            (occurrence_id, tenant_id),
        ).fetchone()
        if not previous:
            raise ApiError(HTTPStatus.NOT_FOUND, "Ocorrencia nao encontrada.")
        status = normalize_occurrence_status(data.get("status") or previous["status"])
        allowed_statuses = {"aberta", "em_analise", "recusada", "solucionada"}
        if status not in allowed_statuses:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Status de ocorrencia invalido.")
        resolution = str(data.get("resolution") or "").strip()
        resolved_at = str(data.get("resolved_at") or "").strip() or previous["resolved_at"]
        timestamp = now_iso()
        if status == "solucionada" and not resolved_at:
            resolved_at = timestamp
        if status != "solucionada":
            resolved_at = None
        cur = conn.execute(
            """
            UPDATE occurrences
            SET status = ?, resolution = ?, resolved_at = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
            """,
            (status, resolution, resolved_at, timestamp, occurrence_id, tenant_id),
        )
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Ocorrencia nao encontrada.")
        changed = (
            normalize_occurrence_status(previous["status"]) != status
            or str(previous["resolution"] or "").strip() != resolution
            or str(previous["resolved_at"] or "").strip() != str(resolved_at or "").strip()
        )
        if changed:
            conn.execute(
                """
                INSERT INTO occurrence_events
                    (occurrence_id, tenant_id, status, title, notes, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    occurrence_id,
                    tenant_id,
                    status,
                    occurrence_status_label(status),
                    resolution or "Ocorrencia atualizada pela retaguarda.",
                    int(TENANT_CONTEXT.get(id(conn), {}).get("id") or 0) or None,
                    timestamp,
                ),
            )
        return {"message": "Ocorrencia atualizada."}

    def delete_occurrence(self, conn: sqlite3.Connection, occurrence_id: int) -> dict[str, Any]:
        cur = conn.execute(
            "DELETE FROM occurrences WHERE id = ? AND tenant_id = ?",
            (occurrence_id, current_tenant_id(conn)),
        )
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Ocorrencia nao encontrada.")
        return {"message": "Ocorrencia excluida definitivamente."}

    def occurrence_pdf(self, conn: sqlite3.Connection, user: dict[str, Any], occurrence_id: int) -> bytes:
        occurrence = next((item for item in self.occurrences(conn, user) if int(item["id"]) == int(occurrence_id)), None)
        if not occurrence:
            raise ApiError(HTTPStatus.NOT_FOUND, "Ocorrencia nao encontrada.")
        attachment_names = occurrence.get("attachment_names") or []
        try:
            from html import escape

            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                leftMargin=28 * mm,
                rightMargin=24 * mm,
                topMargin=24 * mm,
                bottomMargin=22 * mm,
            )
            styles = getSampleStyleSheet()
            ink = colors.HexColor("#2b1836")
            muted = colors.HexColor("#5f5368")
            purple = colors.HexColor("#6d267c")
            styles.add(ParagraphStyle(name="OccTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=21, textColor=ink, spaceAfter=12))
            styles.add(ParagraphStyle(name="OccId", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=purple, spaceAfter=16))
            styles.add(ParagraphStyle(name="OccLine", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5, leading=14, textColor=ink, spaceAfter=9))
            styles.add(ParagraphStyle(name="OccBlock", parent=styles["OccLine"], leftIndent=32, firstLineIndent=0, spaceAfter=12))
            styles.add(ParagraphStyle(name="OccSection", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=ink, spaceBefore=4, spaceAfter=5))

            def txt(value: Any) -> str:
                return escape(str(value or "-"))

            def line(label: str, value: Any) -> Paragraph:
                return Paragraph(f"<b>{escape(label)}:</b>&nbsp;&nbsp; {txt(value)}", styles["OccLine"])

            story: list[Any] = [
                Paragraph("Registro de Ocorrência", styles["OccTitle"]),
                Paragraph(f"R.O. #{txt(occurrence.get('id'))}", styles["OccId"]),
                line("Criada em", format_datetime_for_pdf(occurrence.get("created_at"))),
                line("Representante Comercial", str(occurrence.get("seller_name") or "-").upper()),
                line("Motivo da Ocorrência", str(occurrence.get("reason") or "-").upper()),
                Spacer(1, 5 * mm),
                Paragraph("<b>Cliente:</b>", styles["OccSection"]),
                Paragraph("<br/>".join([
                    txt(occurrence.get("customer_name")),
                    txt(occurrence.get("customer_trade_name")),
                    txt(occurrence.get("customer_cnpj")),
                    txt(occurrence.get("customer_address")),
                    txt(occurrence.get("customer_phone")),
                    txt(occurrence.get("customer_email")),
                ]), styles["OccBlock"]),
                line("Relato", occurrence.get("description") or "-"),
                line("Anexos", f"{len(attachment_names)} ANEXO(S)" if attachment_names else "SEM ANEXOS"),
                Spacer(1, 4 * mm),
                line("Status Ocorrência", occurrence_status_label(normalize_occurrence_status(occurrence.get("status"))).upper()),
                line("Data da Resolução", format_date_for_pdf(occurrence.get("resolved_at")) or "-"),
                line("Parecer sobre a Ocorrência", occurrence.get("resolution") or "-"),
            ]
            doc.build(story)
            return buffer.getvalue()
        except Exception as exc:
            print(f"Falha ao gerar PDF da ocorrencia #{occurrence_id}: {exc}")
            return simple_pdf([
                f"REGISTRO DE OCORRENCIA #{occurrence.get('id')}",
                f"Criada em: {format_datetime_for_pdf(occurrence.get('created_at'))}",
                f"Representante Comercial: {occurrence.get('seller_name') or '-'}",
                f"Motivo da Ocorrencia: {occurrence.get('reason') or '-'}",
                f"Cliente: {occurrence.get('customer_name') or '-'}",
                f"Relato: {occurrence.get('description') or '-'}",
                f"Anexos: {len(attachment_names)} ANEXO(S)" if attachment_names else "Anexos: SEM ANEXOS",
                f"Status Ocorrencia: {occurrence_status_label(normalize_occurrence_status(occurrence.get('status')))}",
                f"Parecer sobre a Ocorrencia: {occurrence.get('resolution') or '-'}",
            ])

    def proposal_pdf(self, conn: sqlite3.Connection, user: dict[str, Any], proposal_id: int) -> bytes:
        proposal = next((item for item in self.proposals(conn, user) if int(item["id"]) == int(proposal_id)), None)
        if not proposal:
            raise ApiError(HTTPStatus.NOT_FOUND, "Pedido nao encontrado.")
        order_statuses = normalize_order_statuses(read_setting(conn, "order_statuses", DEFAULT_SETTINGS["order_statuses"]))
        try:
            return professional_order_pdf_v2(proposal, order_statuses)
        except Exception as exc:
            print(f"Falha ao gerar PDF profissional do pedido #{proposal_id}: {exc}")
            lines = proposal_pdf_lines(proposal)
            return simple_pdf(lines)
