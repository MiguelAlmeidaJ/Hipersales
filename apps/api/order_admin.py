from __future__ import annotations

"""Aprovações, pedidos, clientes e consulta de CNPJ."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class OrderAdminMixin:
    def update_registration_request(self, conn: sqlite3.Connection, request_id: int, data: dict[str, Any]) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        request_row = conn.execute(
            "SELECT * FROM registration_requests WHERE id = ? AND tenant_id = ?",
            (request_id, tenant_id),
        ).fetchone()
        if not request_row:
            raise ApiError(HTTPStatus.NOT_FOUND, "Solicitacao nao encontrada.")
        request_data = dict(request_row)
        status = data.get("status", request_data["status"])
        if status not in {"pendente", "aprovada", "recusada"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Status invalido.")
        existing_payload = safe_json_loads(request_data.get("form_payload"), {})
        if not isinstance(existing_payload, dict):
            existing_payload = {}
        submitted_payload = safe_json_loads(data.get("form_payload"), {})
        if not isinstance(submitted_payload, dict):
            submitted_payload = {}
        payload = {**existing_payload, **submitted_payload}
        lookup = payload.get("_lookup", {}) if isinstance(payload.get("_lookup", {}), dict) else {}
        def request_value(field: str, *fallback_fields: str) -> Any:
            if field in data:
                return data.get(field)
            for payload_field in (field, *fallback_fields):
                if isinstance(payload, dict) and payload_field in payload:
                    return payload.get(payload_field)
            for row_field in (field, *fallback_fields):
                if row_field in request_data:
                    return request_data.get(row_field)
            return ""

        editable_fields = {
            "legal_name": request_value("legal_name"),
            "trade_name": request_value("trade_name"),
            "cnpj": request_value("cnpj"),
            "state_registration": request_value("state_registration"),
            "address": request_value("address"),
            "phone_1": request_value("phone_1", "phone"),
            "purchase_email": request_value("purchase_email", "email"),
            "delivery_warnings": request_value("delivery_warnings", "notes"),
        }
        form_payload = json.dumps(
            {
                **payload,
                **{key: value for key, value in data.items() if key not in {"status", "form_payload"}},
                **editable_fields,
            },
            ensure_ascii=False,
        )
        customer_address = first_text(
            build_customer_address_from_payload({
                "address": data.get("address") or payload.get("address") or lookup.get("address_line") or lookup.get("address"),
                "neighborhood": data.get("neighborhood") or payload.get("neighborhood") or payload.get("bairro") or lookup.get("neighborhood"),
                "city": data.get("city") or payload.get("city") or lookup.get("city"),
                "state": data.get("state") or payload.get("state") or lookup.get("state"),
                "zip_code": data.get("zip_code") or payload.get("zip_code") or lookup.get("zip_code"),
            }),
            editable_fields.get("address"),
        )
        cur = conn.execute(
            """
            UPDATE registration_requests
            SET legal_name = ?, trade_name = ?, cnpj = ?, state_registration = ?, address = ?, phone = ?, email = ?, notes = ?, form_payload = ?, status = ?
            WHERE id = ? AND tenant_id = ?
            """,
            (
                editable_fields["legal_name"],
                editable_fields.get("trade_name"),
                editable_fields["cnpj"],
                editable_fields.get("state_registration"),
                customer_address,
                editable_fields["phone_1"],
                editable_fields.get("purchase_email"),
                editable_fields.get("delivery_warnings"),
                form_payload,
                status,
                request_id,
                tenant_id,
            ),
        )
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Solicitacao nao encontrada.")
        if status == "aprovada":
            current_request = conn.execute(
                "SELECT * FROM registration_requests WHERE id = ? AND tenant_id = ?",
                (request_id, tenant_id),
            ).fetchone()
            if not current_request:
                raise ApiError(HTTPStatus.NOT_FOUND, "Solicitacao nao encontrada.")
            current_request = dict(current_request)
            customer_row = conn.execute(
                "SELECT id FROM customers WHERE cnpj = ? AND tenant_id = ?",
                (current_request["cnpj"], tenant_id),
            ).fetchone()
            if customer_row:
                customer_id = customer_row["id"]
                conn.execute(
                    """
                    UPDATE customers
                    SET legal_name = ?, trade_name = ?, state_registration = ?, address = ?, phone = ?, email = ?, form_payload = ?, active = 1
                    WHERE id = ? AND tenant_id = ?
                    """,
                    (
                        current_request["legal_name"],
                        current_request["trade_name"],
                        current_request["state_registration"],
                        customer_address,
                        current_request["phone"],
                        current_request["email"],
                        current_request.get("form_payload"),
                        customer_row["id"],
                        tenant_id,
                    ),
                )
            else:
                duplicate_customer = self.customer_by_cnpj(conn, current_request["cnpj"])
                if duplicate_customer:
                    raise ApiError(HTTPStatus.CONFLICT, "Ja existe esse CNPJ na nossa base.")
                customer_cur = conn.execute(
                    """
                    INSERT INTO customers
                        (tenant_id, legal_name, trade_name, cnpj, state_registration, address, phone, email, form_payload, active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        tenant_id,
                        current_request["legal_name"],
                        current_request["trade_name"],
                        current_request["cnpj"],
                        current_request["state_registration"],
                        customer_address,
                        current_request["phone"],
                        current_request["email"],
                        current_request.get("form_payload"),
                        1,
                        now_iso(),
                    ),
                )
                customer_id = inserted_id(customer_cur)
            conn.execute(
                "INSERT OR IGNORE INTO customer_sellers (customer_id, seller_id) VALUES (?, ?)",
                (customer_id, current_request["seller_id"]),
            )
            if request_row["status"] != "aprovada":
                context = customer_request_context(conn, request_id, status)
                templates = normalize_templates_settings(read_setting(conn, "message_templates", DEFAULT_SETTINGS["message_templates"]))
                email_template = templates["email"]["customer_approved"]
                subject = render_template(email_template["subject"], context)
                body = render_template(email_template["body"], context)
                body = append_html_notice(body, context["apto_novos_pedidos"])
                conn.execute(
                    "INSERT INTO email_outbox (tenant_id, kind, recipients, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (tenant_id, "customer_status_email", "vendas@hipermixrepresentacoes.com.br", subject, body, now_iso()),
                )

                whatsapp = read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])
                if whatsapp.get("enabled"):
                    whatsapp_template = templates["whatsapp"]["customer_approved"]
                    whatsapp_subject = render_template(whatsapp_template["subject"], context)
                    whatsapp_body = render_template(whatsapp_template["body"], context)
                    whatsapp_target = context.get("vendedor_whatsapp") or whatsapp.get("alert_phone") or whatsapp.get("instance_id") or whatsapp.get("connection_name", "whatsapp")
                    conn.execute(
                        "INSERT INTO email_outbox (tenant_id, kind, recipients, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (tenant_id, "customer_status_whatsapp", f"whatsapp:{whatsapp_target}", whatsapp_subject, whatsapp_body, now_iso()),
                    )
        return {"message": "Solicitacao atualizada."}

    def update_proposal_status(self, conn: sqlite3.Connection, user: dict[str, Any], proposal_id: int, data: dict[str, Any]) -> dict[str, Any]:
        status = data.get("status")
        if status == "proposta_enviada":
            status = "em_analise"
        if status == "proposta_recusada":
            status = "recusado"
        previous = conn.execute(
            """
            SELECT status, admin_notes, delivery_forecast, industry_order_number, invoice_number,
                   order_type, purchase_order, commission_percent, invoice_type, freight_type,
                   delivery_type, scheduled_delivery_date, discount_percent, discount_on,
                   payment_terms, notes, tax_operator_invoice
            FROM proposals
            WHERE id = ? AND tenant_id = ?
            """,
            (proposal_id, current_tenant_id(conn)),
        ).fetchone()
        if not previous:
            raise ApiError(HTTPStatus.NOT_FOUND, "Proposta nao encontrada.")
        if not status:
            status = previous["status"]
        if status not in STATUS_LABELS:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Status invalido.")
        previous_rank = ORDER_STATUS_RANK.get(str(previous["status"] or ""))
        next_rank = ORDER_STATUS_RANK.get(str(status or ""))
        if previous_rank is not None and next_rank is not None and next_rank < previous_rank:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Nao e permitido voltar o pedido para uma etapa anterior.")
        timestamp = now_iso()
        delivery_forecast = data["delivery_forecast"] if "delivery_forecast" in data else previous["delivery_forecast"]
        industry_order_number = data["industry_order_number"] if "industry_order_number" in data else previous["industry_order_number"]
        invoice_number = data["invoice_number"] if "invoice_number" in data else previous["invoice_number"]
        order_type = data["order_type"] if "order_type" in data else previous["order_type"]
        purchase_order = data["purchase_order"] if "purchase_order" in data else previous["purchase_order"]
        commission_percent = parse_percentage_value(data["commission_percent"]) if "commission_percent" in data else float(previous["commission_percent"] or 0)
        invoice_type = data["invoice_type"] if "invoice_type" in data else previous["invoice_type"]
        tax_operator_invoice = int(previous["tax_operator_invoice"] or 0)
        if "tax_operator_invoice" in data:
            tax_operator_invoice = 1 if coerce_bool(data["tax_operator_invoice"]) else 0
        freight_type = data["freight_type"] if "freight_type" in data else previous["freight_type"]
        delivery_type = data["delivery_type"] if "delivery_type" in data else previous["delivery_type"]
        scheduled_delivery_date = data["scheduled_delivery_date"] if "scheduled_delivery_date" in data else previous["scheduled_delivery_date"]
        if "scheduled_delivery_date" in data:
            scheduled_delivery_date = scheduled_delivery_date or None
        if delivery_type != "Entrega Programada":
            scheduled_delivery_date = None
        discount_percent = parse_percentage_value(data["discount_percent"]) if "discount_percent" in data else float(previous["discount_percent"] or 0)
        discount_on = normalize_discount_on(data["discount_on"]) if "discount_on" in data else previous["discount_on"]
        payment_terms = data["payment_terms"] if "payment_terms" in data else previous["payment_terms"]
        if is_bonus_order_type(order_type):
            payment_terms = ""
            commission_percent = 0.0
            discount_percent = 0.0
            discount_on = "Sem descontos"
        elif not str(payment_terms or "").strip():
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe a forma de pagamento.")
        notes = data["notes"] if "notes" in data else previous["notes"]
        admin_notes = data["admin_notes"] if "admin_notes" in data else previous["admin_notes"]
        cur = conn.execute(
            """
            UPDATE proposals
            SET status = ?,
                admin_notes = ?,
                delivery_forecast = ?,
                industry_order_number = ?,
                invoice_number = ?,
                order_type = ?,
                purchase_order = ?,
                commission_percent = ?,
                invoice_type = ?,
                tax_operator_invoice = ?,
                freight_type = ?,
                delivery_type = ?,
                scheduled_delivery_date = ?,
                discount_percent = ?,
                discount_on = ?,
                payment_terms = ?,
                notes = ?,
                updated_at = ?
            WHERE id = ?
              AND tenant_id = ?
            """,
            (
                status,
                admin_notes,
                delivery_forecast,
                industry_order_number,
                invoice_number,
                order_type,
                purchase_order,
                commission_percent,
                invoice_type,
                tax_operator_invoice,
                freight_type,
                delivery_type,
                scheduled_delivery_date,
                discount_percent,
                discount_on,
                payment_terms,
                notes,
                timestamp,
                proposal_id,
                current_tenant_id(conn),
            ),
        )
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Proposta nao encontrada.")
        if "items" in data:
            items = data.get("items") or []
            if not items:
                raise ApiError(HTTPStatus.BAD_REQUEST, "O pedido deve ter ao menos um produto.")
            company_row = conn.execute(
                "SELECT company_id FROM proposals WHERE id = ? AND tenant_id = ?",
                (proposal_id, current_tenant_id(conn)),
            ).fetchone()
            normalized_items = []
            for item in items:
                required(item, ["product_id", "quantity", "negotiated_price"])
                quantity = float(item["quantity"])
                negotiated_price = float(item["negotiated_price"])
                if quantity <= 0 or negotiated_price < 0:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Quantidade e preco dos itens devem ser validos.")
                product = conn.execute(
                    "SELECT id FROM products WHERE id = ? AND tenant_id = ? AND company_id = ? AND active = 1",
                    (item["product_id"], current_tenant_id(conn), company_row["company_id"]),
                ).fetchone()
                if not product:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Produto invalido para a empresa do pedido.")
                normalized_items.append((proposal_id, int(item["product_id"]), quantity, negotiated_price))
            conn.execute("DELETE FROM proposal_items WHERE proposal_id = ?", (proposal_id,))
            conn.executemany(
                "INSERT INTO proposal_items (proposal_id, product_id, quantity, negotiated_price) VALUES (?, ?, ?, ?)",
                normalized_items,
            )
        status_changed = previous["status"] != status
        if status_changed:
            conn.execute(
                """
                INSERT INTO proposal_events (proposal_id, status, title, notes, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    proposal_id,
                    status,
                    STATUS_LABELS.get(status, status),
                    data.get("admin_notes") or "",
                    user.get("id"),
                    timestamp,
                ),
            )

        if status_changed:
            context = template_context(conn, proposal_id, status)
            if status == "pedido_aprovado":
                recipient = context.get("vendedor_email")
                if recipient:
                    queue_outbox(
                        conn,
                        "status_update_seller",
                        recipient,
                        format_proposal_subject(conn, proposal_id, f"STATUS DO PEDIDO {status_email_subject_label(status)}"),
                        format_status_email_message(context),
                    )
                queue_outbox(
                    conn,
                    "approved_order_backoffice",
                    "vendas@hipermixrepresentacoes.com.br",
                    format_proposal_subject(conn, proposal_id, "NOVO PEDIDO"),
                    format_approved_order_email(conn, proposal_id),
                )
            elif status == "recusado":
                queue_outbox(
                    conn,
                    "rejected_proposal_seller",
                    context["vendedor_email"],
                    format_proposal_subject(conn, proposal_id, "PROPOSTA RECUSADA"),
                    format_rejected_proposal_email(conn, proposal_id),
                )
            elif status in {"em_producao", "faturado", "entregue"}:
                recipient = context.get("vendedor_email")
                if recipient:
                    queue_outbox(
                        conn,
                        "status_update_seller",
                        recipient,
                        format_proposal_subject(conn, proposal_id, f"STATUS DO PEDIDO {status_email_subject_label(status)}"),
                        format_status_email_message(context),
                    )

            whatsapp = read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])
            if whatsapp.get("enabled"):
                whatsapp_subject = "Status do pedido"
                whatsapp_body = format_status_whatsapp_message(context)
                whatsapp_target = context.get("vendedor_whatsapp") or whatsapp.get("alert_phone") or whatsapp.get("instance_id") or whatsapp.get("connection_name", "whatsapp")
                queue_outbox(conn, "status_whatsapp", f"whatsapp:{whatsapp_target}", whatsapp_subject, whatsapp_body)

        return {"message": "Status atualizado." if status_changed else "Pedido atualizado."}

    def delete_proposal(self, conn: sqlite3.Connection, proposal_id: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        proposal = conn.execute("SELECT id FROM proposals WHERE id = ? AND tenant_id = ?", (proposal_id, tenant_id)).fetchone()
        if not proposal:
            raise ApiError(HTTPStatus.NOT_FOUND, "Pedido nao encontrado.")
        conn.execute("DELETE FROM proposal_items WHERE proposal_id = ?", (proposal_id,))
        conn.execute("DELETE FROM proposal_events WHERE proposal_id = ?", (proposal_id,))
        conn.execute("DELETE FROM proposals WHERE id = ?", (proposal_id,))
        return {"message": "Pedido excluido definitivamente."}

    def create_customer(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["legal_name", "cnpj"])
        tenant_id = current_tenant_id(conn)
        digits = normalize_cnpj_digits(data["cnpj"])
        existing_customer = self.customer_by_cnpj(conn, digits)
        if existing_customer:
            raise ApiError(HTTPStatus.CONFLICT, "Ja existe esse CNPJ na nossa base.")
        lookup = self.safe_customer_lookup_for_save(conn, digits)
        phone = first_text(data.get("phone"), data.get("phone_1"), data.get("buyer_phone_1"), lookup.get("phone"))
        email = first_text(data.get("email"), data.get("purchase_email"), data.get("buyer_email"), lookup.get("email"))
        form_payload = json.dumps({**data, "phone": phone, "email": email, "_lookup": lookup}, ensure_ascii=False)
        enriched = {
            "state_registration": first_text(data.get("state_registration"), lookup.get("state_registration")),
            "address": first_text(build_customer_address_from_payload(data), lookup.get("address")),
            "phone": phone,
            "email": email,
        }
        try:
            cur = conn.execute(
                """
                INSERT INTO customers
                    (tenant_id, legal_name, trade_name, cnpj, state_registration, address, phone, email, form_payload, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tenant_id,
                    data["legal_name"],
                    data.get("trade_name"),
                    data["cnpj"],
                    enriched.get("state_registration"),
                    enriched.get("address"),
                    enriched.get("phone"),
                    enriched.get("email"),
                    form_payload,
                    1 if data.get("active", True) else 0,
                    now_iso(),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Este CNPJ ja foi cadastrado.") from exc
        return {"id": inserted_id(cur), "message": "Cliente cadastrado."}

    def update_customer(self, conn: sqlite3.Connection, customer_id: int, data: dict[str, Any]) -> dict[str, Any]:
        required(data, ["legal_name", "cnpj"])
        tenant_id = current_tenant_id(conn)
        digits = normalize_cnpj_digits(data["cnpj"])
        existing_customer = self.customer_by_cnpj(conn, digits, exclude_id=customer_id)
        if existing_customer:
            raise ApiError(HTTPStatus.CONFLICT, "Ja existe esse CNPJ na nossa base.")
        lookup = self.safe_customer_lookup_for_save(conn, digits)
        phone = first_text(data.get("phone"), data.get("phone_1"), data.get("buyer_phone_1"), lookup.get("phone"))
        email = first_text(data.get("email"), data.get("purchase_email"), data.get("buyer_email"), lookup.get("email"))
        form_payload = json.dumps({**data, "phone": phone, "email": email, "_lookup": lookup}, ensure_ascii=False)
        enriched = {
            "state_registration": first_text(data.get("state_registration"), lookup.get("state_registration")),
            "address": first_text(build_customer_address_from_payload(data), lookup.get("address")),
            "phone": phone,
            "email": email,
        }
        try:
            cur = conn.execute(
                """
                UPDATE customers
                SET legal_name = ?, trade_name = ?, cnpj = ?, state_registration = ?, address = ?, phone = ?, email = ?, form_payload = ?, active = ?
                WHERE id = ? AND tenant_id = ?
                """,
                (
                    data["legal_name"],
                    data.get("trade_name"),
                    data["cnpj"],
                    enriched.get("state_registration"),
                    enriched.get("address"),
                    enriched.get("phone"),
                    enriched.get("email"),
                    form_payload,
                    1 if data.get("active", True) else 0,
                    customer_id,
                    tenant_id,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ApiError(HTTPStatus.CONFLICT, "Este CNPJ ja foi cadastrado.") from exc
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Cliente nao encontrado.")
        return {"id": customer_id, "message": "Cliente atualizado."}

    def safe_customer_lookup_for_save(self, conn: sqlite3.Connection, cnpj: str) -> dict[str, Any]:
        try:
            return self.fetch_cnpj_payload(cnpj)
        except ApiError as exc:
            print(f"Consulta de CNPJ ignorada ao salvar cliente: {exc.message}")
            return {}

    def delete_customer(self, conn: sqlite3.Connection, customer_id: int) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        customer = conn.execute("SELECT id FROM customers WHERE id = ? AND tenant_id = ?", (customer_id, tenant_id)).fetchone()
        if not customer:
            raise ApiError(HTTPStatus.NOT_FOUND, "Cliente nao encontrado.")
        used = conn.execute("SELECT 1 FROM proposals WHERE customer_id = ? AND tenant_id = ? LIMIT 1", (customer_id, tenant_id)).fetchone()
        if used:
            raise ApiError(HTTPStatus.CONFLICT, "Cliente ja possui pedido. Inative o cliente para preservar o historico.")
        conn.execute("DELETE FROM customer_sellers WHERE customer_id = ?", (customer_id,))
        cur = conn.execute("DELETE FROM customers WHERE id = ? AND tenant_id = ?", (customer_id, tenant_id))
        if cur.rowcount == 0:
            raise ApiError(HTTPStatus.NOT_FOUND, "Cliente nao encontrado.")
        return {"message": "Cliente excluido."}

    def lookup_cnpj(self, conn: sqlite3.Connection, cnpj: str, exclude_customer_id: int | None = None) -> dict[str, Any]:
        digits = re.sub(r"\D+", "", str(cnpj or ""))
        if len(digits) != 14:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe um CNPJ valido.")
        existing_customer = self.customer_by_cnpj(conn, digits, exclude_id=exclude_customer_id)
        if existing_customer:
            raise ApiError(HTTPStatus.CONFLICT, "Ja existe esse CNPJ na nossa base.")
        payload = self.fetch_cnpj_payload(digits)
        raw_payload = payload.get("_raw") if isinstance(payload.get("_raw"), dict) else payload
        municipio = first_text(payload.get("municipio"), payload.get("municipio_nome"), payload.get("cidade"))
        uf = first_text(payload.get("uf"), payload.get("estado"))
        cep = first_text(payload.get("cep"), payload.get("codigo_postal"))
        logradouro = first_text(payload.get("logradouro"), payload.get("rua"), payload.get("endereco"))
        numero = first_text(payload.get("numero"), payload.get("numero_endereco"))
        complemento = first_text(payload.get("complemento"), payload.get("complemento_endereco"))
        bairro = first_text(payload.get("bairro"), payload.get("bairro_distrito"))
        address_line = " ".join(part for part in [logradouro, numero, complemento] if part)
        address_parts = [part for part in [logradouro, numero, complemento, bairro] if part]
        city_part = f"{municipio}/{uf}" if municipio or uf else ""
        full_address = ", ".join([part for part in [" ".join(address_parts), city_part, cep] if part])
        return {
            "cnpj": f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}",
            "legal_name": first_text(
                payload.get("razao_social"),
                payload.get("nome"),
                payload.get("nome_empresarial"),
                payload.get("nome_razao_social"),
            ),
            "trade_name": first_text(payload.get("fantasia"), payload.get("nome_fantasia"), payload.get("nome_comercial")),
            "state_registration": first_text(payload.get("inscricao_estadual"), payload.get("ie")),
            "address": full_address,
            "address_line": address_line,
            "neighborhood": bairro,
            "phone": first_text(payload.get("ddd_telefone_1"), payload.get("ddd_telefone_2"), payload.get("telefone"), payload.get("telefone1")),
            "email": first_text(payload.get("email"), payload.get("endereco_eletronico")),
            "city": municipio,
            "state": uf,
            "zip_code": cep,
            "status": first_text(payload.get("situacao_cadastral"), payload.get("descricao_situacao_cadastral")),
            "main_activity": first_text(payload.get("atividade_principal"), payload.get("cnae_fiscal_descricao")),
            "company_size": first_text(payload.get("porte"), payload.get("porte_descricao")),
            "legal_nature": first_text(payload.get("natureza_juridica"), payload.get("natureza_juridica_descricao")),
            "simples": first_text(payload.get("simples")),
            "mei": first_text(payload.get("mei")),
            "started_at": first_text(payload.get("data_inicio_atividade"), payload.get("inicio_atividade")),
            "raw": raw_payload,
        }

    def fetch_cnpj_payload(self, digits: str) -> dict[str, Any]:
        public_url = f"https://publica.cnpj.ws/cnpj/{digits}"
        public_request = urllib.request.Request(
            public_url,
            headers={
                "Accept": "application/json",
                "User-Agent": "HiperSalesWeb/1.0 (+https://hipersalesweb.com.br)",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(public_request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
                normalized = self.normalize_public_cnpj_ws_payload(payload)
                if normalized:
                    return normalized
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else str(exc)
            print(f"Falha ao consultar CNPJ.ws: {detail}")
        except Exception as exc:
            print(f"Falha ao consultar CNPJ.ws: {exc}")

        url = f"https://brasilapi.com.br/api/cnpj/v1/{digits}"
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
                normalized = self.unwrap_cnpj_payload(payload)
                if normalized:
                    return normalized
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else str(exc)
            raise ApiError(HTTPStatus.BAD_GATEWAY, f"Falha ao consultar CNPJ: {detail}") from exc
        except Exception as exc:
            raise ApiError(HTTPStatus.BAD_GATEWAY, f"Falha ao consultar CNPJ: {exc}") from exc
        return {}

    @staticmethod
    def normalize_public_cnpj_ws_payload(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}

        estabelecimento = payload.get("estabelecimento") if isinstance(payload.get("estabelecimento"), dict) else {}
        cidade = estabelecimento.get("cidade") if isinstance(estabelecimento.get("cidade"), dict) else {}
        estado = estabelecimento.get("estado") if isinstance(estabelecimento.get("estado"), dict) else {}
        atividade_principal = (
            estabelecimento.get("atividade_principal")
            if isinstance(estabelecimento.get("atividade_principal"), dict)
            else {}
        )
        porte = payload.get("porte") if isinstance(payload.get("porte"), dict) else {}
        natureza = payload.get("natureza_juridica") if isinstance(payload.get("natureza_juridica"), dict) else {}
        simples = payload.get("simples") if isinstance(payload.get("simples"), dict) else {}
        inscricoes = estabelecimento.get("inscricoes_estaduais")
        inscricoes = inscricoes if isinstance(inscricoes, list) else []
        ie = ""
        for item in inscricoes:
            if isinstance(item, dict) and item.get("ativo") and first_text(item.get("inscricao_estadual")):
                ie = first_text(item.get("inscricao_estadual"))
                break
        if not ie:
            for item in inscricoes:
                if isinstance(item, dict) and first_text(item.get("inscricao_estadual")):
                    ie = first_text(item.get("inscricao_estadual"))
                    break

        tipo_logradouro = first_text(estabelecimento.get("tipo_logradouro"))
        logradouro_nome = first_text(estabelecimento.get("logradouro"))
        logradouro = " ".join(part for part in [tipo_logradouro, logradouro_nome] if part)

        def phone_from_parts(ddd: Any, number: Any) -> str:
            ddd_text = first_text(ddd)
            number_text = first_text(number)
            if ddd_text and number_text:
                return f"({ddd_text}) {number_text}"
            return first_text(number_text, ddd_text)

        return {
            "razao_social": first_text(payload.get("razao_social")),
            "nome_fantasia": first_text(estabelecimento.get("nome_fantasia")),
            "inscricao_estadual": ie,
            "logradouro": logradouro,
            "numero": first_text(estabelecimento.get("numero")),
            "complemento": first_text(estabelecimento.get("complemento")),
            "bairro": first_text(estabelecimento.get("bairro")),
            "municipio": first_text(cidade.get("nome")),
            "uf": first_text(estado.get("sigla")),
            "cep": first_text(estabelecimento.get("cep")),
            "ddd_telefone_1": phone_from_parts(estabelecimento.get("ddd1"), estabelecimento.get("telefone1")),
            "ddd_telefone_2": phone_from_parts(estabelecimento.get("ddd2"), estabelecimento.get("telefone2")),
            "email": first_text(estabelecimento.get("email")),
            "situacao_cadastral": first_text(estabelecimento.get("situacao_cadastral")),
            "data_inicio_atividade": first_text(estabelecimento.get("data_inicio_atividade")),
            "atividade_principal": first_text(atividade_principal.get("descricao")),
            "porte": first_text(porte.get("descricao")),
            "natureza_juridica": first_text(natureza.get("descricao")),
            "simples": first_text(simples.get("simples")),
            "mei": first_text(simples.get("mei")),
            "_raw": payload,
        }

    @staticmethod
    def unwrap_cnpj_payload(payload: Any) -> dict[str, Any]:
        if isinstance(payload, dict):
            for key in ("response", "data", "result", "results", "payload", "content"):
                nested = payload.get(key)
                if isinstance(nested, dict):
                    return nested
                if isinstance(nested, list) and nested and isinstance(nested[0], dict):
                    return nested[0]
            return payload
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            return payload[0]
        return {}
