from __future__ import annotations

"""Visão administrativa, configurações e integração WhatsApp."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class AdminDashboardMixin:
    def admin_summary(self, conn: sqlite3.Connection) -> dict[str, Any]:
        return {
            "registration_requests": [
                dict(row)
                for row in conn.execute(
                    """
                    SELECT rr.*, u.name AS seller_name
                    FROM registration_requests rr
                    JOIN users u ON u.id = rr.seller_id
                    WHERE rr.tenant_id = ?
                    ORDER BY rr.created_at DESC
                    """,
                    (current_tenant_id(conn),),
                )
            ],
            "proposals": self.proposals(conn, {"role": "admin", "id": 0}),
        }

    def admin_overview(self, conn: sqlite3.Connection) -> dict[str, Any]:
        tenant_id = current_tenant_id(conn)
        summary = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND active = 1) AS users,
                (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'admin' AND active = 1) AS admins,
                (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'seller' AND active = 1) AS sellers,
                (SELECT COUNT(*) FROM companies WHERE tenant_id = ? AND active = 1) AS companies,
                (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND active = 1) AS products,
                (SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND active = 1) AS customers,
                (SELECT COUNT(*) FROM customer_sellers cs JOIN customers c ON c.id = cs.customer_id WHERE c.tenant_id = ?) AS associations,
                (SELECT COUNT(*) FROM proposals WHERE tenant_id = ?) AS proposals,
                (SELECT COUNT(*) FROM proposals WHERE tenant_id = ? AND status = 'pedido_aprovado') AS approved_orders,
                (SELECT COUNT(*) FROM registration_requests WHERE tenant_id = ? AND status = 'pendente') AS pending_requests,
                (SELECT COUNT(*) FROM email_outbox WHERE tenant_id = ?) AS outbox
            """,
            (tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, tenant_id),
        ).fetchone()
        status_rows = conn.execute(
            """
            SELECT status, COUNT(*) AS total
            FROM proposals
            WHERE tenant_id = ?
            GROUP BY status
            """,
            (tenant_id,),
        ).fetchall()
        return {
            "summary": dict(summary),
            "status_counts": {row["status"]: row["total"] for row in status_rows},
        }

    def admin_settings(self, conn: sqlite3.Connection) -> dict[str, Any]:
        customer_funnel = read_setting(conn, "customer_funnel", DEFAULT_SETTINGS["customer_funnel"])
        product_funnel = read_setting(conn, "product_funnel", DEFAULT_SETTINGS["product_funnel"])
        order_statuses = normalize_order_statuses(read_setting(conn, "order_statuses", DEFAULT_SETTINGS["order_statuses"]))
        smtp = read_setting(conn, "smtp", DEFAULT_SETTINGS["smtp"])
        whatsapp = self.refresh_whatsapp_status(conn, normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])))
        templates = normalize_templates_settings(read_setting(conn, "message_templates", DEFAULT_SETTINGS["message_templates"]))
        qr_payload = whatsapp.get("qr_payload") or ""
        qr_image_url = whatsapp.get("qr_image_url") or (whatsapp_qr_image_url(qr_payload) if qr_payload else "")
        whatsapp = {
            **whatsapp,
            "status_label": "Conectado" if whatsapp.get("connected") else "Aguardando QR",
            "qr_payload": qr_payload,
            "qr_image_url": qr_image_url,
        }
        return {
            "settings": {
                "customer_funnel": customer_funnel,
                "product_funnel": product_funnel,
                "order_statuses": order_statuses,
                "smtp": smtp,
                "whatsapp": whatsapp,
                "message_templates": templates,
            },
            "placeholders": PLACEHOLDER_DEFINITIONS,
            "status_labels": STATUS_LABELS,
        }

    def save_admin_settings(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        section = str(data.get("section", "")).strip()
        payload = data.get("data")
        if section not in DEFAULT_SETTINGS:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Secao de configuracao invalida.")

        if section in {"customer_funnel", "product_funnel"}:
            normalized = normalize_stage_list(payload)
        elif section == "order_statuses":
            normalized = normalize_order_statuses(payload)
        elif section == "smtp":
            normalized = normalize_smtp_settings(payload)
        elif section == "whatsapp":
            current = read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])
            normalized = normalize_whatsapp_settings(payload, current)
            if normalized.get("enabled") and normalized.get("instance_id"):
                configure_evolution_webhook(conn, normalized["instance_id"])
        elif section == "message_templates":
            current = read_setting(conn, "message_templates", DEFAULT_SETTINGS["message_templates"])
            normalized = normalize_templates_settings(payload, current)
        else:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Secao de configuracao invalida.")

        write_setting(conn, section, normalized)
        return {"message": "Configuracao salva.", **self.admin_settings(conn)}

    def test_smtp_settings(self, data: dict[str, Any], conn: sqlite3.Connection) -> dict[str, Any]:
        payload = data or read_setting(conn, "smtp", DEFAULT_SETTINGS["smtp"])
        smtp = normalize_smtp_settings(payload)
        if not smtp["host"]:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Informe o servidor SMTP para testar a conexao.")

        context = ssl.create_default_context()
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
            client.quit()
        except Exception as exc:
            raise ApiError(HTTPStatus.BAD_GATEWAY, f"Falha ao testar SMTP: {exc}") from exc

        return {"message": "Conexao SMTP validada com sucesso."}

    def generate_whatsapp_qr(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        current = read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])
        whatsapp = normalize_whatsapp_settings(data or current, current)
        instance_name = evolution_instance_name(conn)
        if whatsapp.get("instance_id") and whatsapp.get("instance_id") != instance_name:
            evolution_try_request("DELETE", f"/instance/delete/{quote_plus(whatsapp['instance_id'])}", timeout=10)
        evolution_try_request("DELETE", f"/instance/delete/{quote_plus(instance_name)}", timeout=10)
        created = evolution_request(
            "POST",
            "/instance/create",
            {
                "instanceName": instance_name,
                "qrcode": True,
                "integration": "WHATSAPP-BAILEYS",
            },
            timeout=45,
        )
        qrcode = created.get("qrcode") if isinstance(created.get("qrcode"), dict) else {}
        if not qrcode.get("base64") and not qrcode.get("code"):
            connected = evolution_request("GET", f"/instance/connect/{quote_plus(instance_name)}", timeout=20)
            qrcode = connected.get("qrcode") if isinstance(connected.get("qrcode"), dict) else connected
        webhook = configure_evolution_webhook(conn, instance_name)
        whatsapp["enabled"] = True
        whatsapp["provider"] = "evolution"
        whatsapp["connected"] = False
        whatsapp["instance_id"] = instance_name
        whatsapp["qr_payload"] = str(qrcode.get("code") or "")
        whatsapp["qr_image_url"] = str(qrcode.get("base64") or "")
        whatsapp["qr_token"] = secrets.token_urlsafe(24)
        whatsapp["last_qr_at"] = now_iso()
        whatsapp["last_error"] = "" if whatsapp["qr_image_url"] or whatsapp["qr_payload"] else "Evolution nao retornou QR. Gere novamente em alguns segundos."
        if webhook.get("error"):
            whatsapp["last_error"] = str(webhook.get("message") or "Falha ao configurar webhook do WhatsApp.")
        whatsapp["connected_at"] = None
        write_setting(conn, "whatsapp", whatsapp)
        return {
            "message": "QR gerado pelo Evolution. Escaneie pelo WhatsApp.",
            "whatsapp": {
                **whatsapp,
                "status_label": "Aguardando QR",
            },
        }

    def disconnect_whatsapp(self, conn: sqlite3.Connection) -> dict[str, Any]:
        current = read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"])
        instance_name = current.get("instance_id") or evolution_instance_name(conn)
        evolution_try_request("DELETE", f"/instance/logout/{quote_plus(instance_name)}", timeout=10)
        evolution_try_request("DELETE", f"/instance/delete/{quote_plus(instance_name)}", timeout=10)
        shutil.rmtree(WHATSAPP_AUTH_DIR, ignore_errors=True)
        current["enabled"] = False
        current["connected"] = False
        current["qr_payload"] = ""
        current["qr_image_url"] = ""
        current["qr_token"] = ""
        current["last_qr_at"] = None
        current["last_error"] = ""
        current["connected_at"] = None
        write_setting(conn, "whatsapp", current)
        return {"message": "Conexao WhatsApp desconectada.", **self.admin_settings(conn)}

    def refresh_whatsapp_status(self, conn: sqlite3.Connection, whatsapp: dict[str, Any]) -> dict[str, Any]:
        if not whatsapp.get("enabled"):
            return whatsapp
        instance_name = whatsapp.get("instance_id") or evolution_instance_name(conn)
        state = evolution_try_request("GET", f"/instance/connectionState/{quote_plus(instance_name)}", timeout=8)
        current_state = ((state.get("instance") or {}).get("state") or "").lower() if isinstance(state, dict) else ""
        if current_state == "open":
            whatsapp["connected"] = True
            whatsapp["connected_at"] = whatsapp.get("connected_at") or now_iso()
            whatsapp["qr_payload"] = ""
            whatsapp["qr_image_url"] = ""
            whatsapp["last_error"] = ""
            write_setting(conn, "whatsapp", whatsapp)
        elif current_state in {"connecting", "close", "closed"}:
            whatsapp["connected"] = False
        return whatsapp

    def handle_evolution_webhook(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        instance_name = str(data.get("instance") or data.get("instanceName") or "")
        TENANT_CONTEXT[id(conn)] = {"tenant_id": tenant_id_from_evolution_instance(instance_name)}
        whatsapp = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
        if not whatsapp.get("enabled") or not whatsapp.get("unavailable_reply_enabled"):
            return {"ok": True, "ignored": "auto_reply_disabled"}

        message_data = data.get("data")
        messages = message_data if isinstance(message_data, list) else [message_data]
        sent = 0
        for message in messages:
            sent += 1 if self.reply_to_incoming_whatsapp_message(conn, whatsapp, instance_name, message) else 0
        return {"ok": True, "sent": sent}

    def reply_to_incoming_whatsapp_message(
        self,
        conn: sqlite3.Connection,
        whatsapp: dict[str, Any],
        instance_name: str,
        message: Any,
    ) -> bool:
        if not isinstance(message, dict):
            return False
        key = message.get("key") if isinstance(message.get("key"), dict) else {}
        if coerce_bool(key.get("fromMe")):
            return False
        remote_jid = str(key.get("remoteJid") or message.get("remoteJid") or message.get("chatId") or "")
        message_id = str(key.get("id") or message.get("id") or "")
        if not remote_jid or not message_id:
            return False
        if "@g.us" in remote_jid or "status@broadcast" in remote_jid:
            return False
        tenant_id = current_tenant_id(conn)
        already = conn.execute(
            """
            SELECT 1 FROM whatsapp_auto_replies
            WHERE tenant_id = ? AND instance_id = ? AND message_id = ?
            """,
            (tenant_id, instance_name, message_id),
        ).fetchone()
        if already:
            return False
        ok, _error = send_evolution_whatsapp(conn, remote_jid, whatsapp["unavailable_reply_message"])
        if not ok:
            return False
        conn.execute(
            """
            INSERT OR IGNORE INTO whatsapp_auto_replies (tenant_id, instance_id, message_id, remote_jid, replied_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tenant_id, instance_name, message_id, remote_jid, now_iso()),
        )
        return True

    def update_whatsapp_internal_state(self, conn: sqlite3.Connection, data: dict[str, Any]) -> dict[str, Any]:
        current = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
        if "enabled" in data:
            current["enabled"] = coerce_bool(data.get("enabled"))
        if "connected" in data:
            connected = coerce_bool(data.get("connected"))
            current["connected"] = connected
            current["connected_at"] = now_iso() if connected else None
        if "qr_payload" in data:
            current["qr_payload"] = str(data.get("qr_payload") or "").strip()
            current["last_qr_at"] = now_iso() if current["qr_payload"] else current.get("last_qr_at")
        if "last_error" in data:
            current["last_error"] = str(data.get("last_error") or "").strip()
        if "instance_id" in data:
            current["instance_id"] = str(data.get("instance_id") or "").strip()
        if current.get("connected"):
            current["qr_payload"] = ""
            current["last_error"] = ""
        write_setting(conn, "whatsapp", current)
        return {"ok": True}

    def whatsapp_pending_messages(self, conn: sqlite3.Connection) -> list[dict[str, Any]]:
        whatsapp = normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))
        if not whatsapp.get("enabled") or not whatsapp.get("connected"):
            return []
        messages: list[dict[str, Any]] = []
        for row in conn.execute(
            """
            SELECT id, kind, recipients, subject, body, attempts, created_at
            FROM email_outbox
            WHERE recipients LIKE 'whatsapp:%'
              AND sent_at IS NULL
              AND COALESCE(attempts, 0) < 5
            ORDER BY id
            LIMIT 10
            """
        ).fetchall():
            payload = dict(row)
            phone = normalize_whatsapp_phone(payload["recipients"].replace("whatsapp:", "", 1))
            if not phone:
                conn.execute(
                    "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
                    ("Numero de WhatsApp vazio ou invalido.", payload["id"]),
                )
                continue
            payload["phone"] = phone
            messages.append(payload)
        return messages

    def update_whatsapp_outbox(self, conn: sqlite3.Connection, outbox_id: int, data: dict[str, Any]) -> dict[str, Any]:
        sent = coerce_bool(data.get("sent", False))
        error = str(data.get("error") or "").strip()
        if sent:
            conn.execute(
                "UPDATE email_outbox SET sent_at = ?, error = NULL WHERE id = ?",
                (now_iso(), outbox_id),
            )
        else:
            conn.execute(
                "UPDATE email_outbox SET attempts = attempts + 1, error = ? WHERE id = ?",
                (error or "Falha ao enviar WhatsApp.", outbox_id),
            )
        return {"ok": True}
