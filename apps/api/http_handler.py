from __future__ import annotations

"""Transporte HTTP, autenticação de sessão e roteamento da API."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class HttpHandlerMixin:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print("[%s] %s" % (self.log_date_time_string(), format % args))

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        parsed = urlparse(self.path)
        if parsed.path.startswith("/assets/"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self) -> Any:
        path = self.translate_path(self.path)
        if (
            self.command in {"GET", "HEAD"}
            and self.headers.get("Accept-Encoding", "").find("gzip") >= 0
            and os.path.isfile(path)
            and Path(path).suffix in {".js", ".css", ".html", ".webmanifest"}
        ):
            with open(path, "rb") as file:
                raw = file.read()
            encoded = gzip.compress(raw, compresslevel=6)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            return io.BytesIO(encoded)
        return super().send_head()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("GET")
            return
        if parsed.path == "/favicon.ico":
            self.path = "/assets/logoapp.png"
            super().do_GET()
            return
        if parsed.path.startswith("/assets/") and (FRONTEND_DIR / parsed.path.lstrip("/")).is_file():
            super().do_GET()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Recurso nao encontrado. Use o frontend Next.js.")

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/favicon.ico":
            self.path = "/assets/logoapp.png"
        elif not (parsed.path.startswith("/assets/") and (FRONTEND_DIR / parsed.path.lstrip("/")).is_file()):
            self.send_error(HTTPStatus.NOT_FOUND, "Recurso nao encontrado.")
            return
        super().do_HEAD()

    def do_POST(self) -> None:
        self.handle_api("POST")

    def do_PATCH(self) -> None:
        self.handle_api("PATCH")

    def do_DELETE(self) -> None:
        self.handle_api("DELETE")

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, "JSON invalido.") from exc

    def send_json(self, status: int, payload: Any, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        should_gzip = len(body) > 1024 and self.headers.get("Accept-Encoding", "").find("gzip") >= 0
        if should_gzip:
            body = gzip.compress(body, compresslevel=6)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if should_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_pdf(self, filename: str, content: bytes) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Content-Disposition", f'inline; filename="{filename}"')
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.end_headers()
        self.wfile.write(content)

    def send_file_bytes(self, filename: str, mimetype: str, content: bytes) -> None:
        safe_filename = re.sub(r'["\r\n]', "", filename or "anexo") or "anexo"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetype or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Content-Disposition", f'inline; filename="{safe_filename}"')
        self.send_header("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0")
        self.end_headers()
        self.wfile.write(content)

    def handle_api(self, method: str) -> None:
        try:
            payload = self.route_api(method, urlparse(self.path))
            if payload is not None:
                self.send_json(HTTPStatus.OK, payload)
        except ApiError as exc:
            self.send_json(exc.status, {"error": exc.message})
        except Exception as exc:
            print(exc)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Erro interno do servidor."})

    def current_user(self, conn: sqlite3.Connection) -> dict[str, Any]:
        cookie = SimpleCookie(self.headers.get("Cookie"))
        morsel = cookie.get(SESSION_COOKIE)
        if not morsel:
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Sessao expirada. Faca login novamente.")
        cleanup_sessions(conn)
        row = conn.execute(
            """
            SELECT u.id, u.tenant_id, t.name AS tenant_name, u.name, u.email, u.communication_email, u.whatsapp_phone,
                   u.role, u.is_super_admin, u.active, u.must_change_password, u.password_updated_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN tenants t ON t.id = u.tenant_id
            WHERE s.token = ? AND u.active = 1
            """,
            (morsel.value,),
        ).fetchone()
        if not row:
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Sessao expirada. Faca login novamente.")
        user = dict(row)
        if coerce_bool(user.get("is_super_admin")):
            user["role"] = "super_admin"
        return user

    def require_admin(self, user: dict[str, Any]) -> None:
        if user["role"] != "admin":
            raise ApiError(HTTPStatus.FORBIDDEN, "Acesso permitido apenas para administradores.")

    def require_super_admin(self, user: dict[str, Any]) -> None:
        if user["role"] != "super_admin":
            raise ApiError(HTTPStatus.FORBIDDEN, "Acesso permitido apenas para super administradores.")

    def require_whatsapp_internal(self, query: dict[str, list[str]]) -> None:
        expected = whatsapp_internal_token()
        provided = self.headers.get("X-Hipersales-Token", "").strip() or query.get("token", [""])[0].strip()
        if not expected or not provided or not hmac.compare_digest(expected, provided):
            raise ApiError(HTTPStatus.FORBIDDEN, "Token interno invalido.")

    def route_whatsapp_internal(self, conn: sqlite3.Connection, method: str, path: str, query: dict[str, list[str]]) -> Any:
        self.require_whatsapp_internal(query)
        if method == "GET" and path == "/api/internal/whatsapp/settings":
            return {"whatsapp": normalize_whatsapp_settings(read_setting(conn, "whatsapp", DEFAULT_SETTINGS["whatsapp"]))}
        if method == "POST" and path == "/api/internal/whatsapp/state":
            return self.update_whatsapp_internal_state(conn, self.read_json())
        if method == "GET" and path == "/api/internal/whatsapp/pending":
            return {"messages": self.whatsapp_pending_messages(conn)}
        if method == "POST" and path.startswith("/api/internal/whatsapp/outbox/"):
            outbox_id = int(path.rsplit("/", 1)[-1])
            return self.update_whatsapp_outbox(conn, outbox_id, self.read_json())
        raise ApiError(HTTPStatus.NOT_FOUND, "Endpoint interno nao encontrado.")

    def route_evolution_webhook(self, conn: sqlite3.Connection, method: str, query: dict[str, list[str]]) -> dict[str, Any]:
        self.require_whatsapp_internal(query)
        if method != "POST":
            raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "Metodo nao permitido.")
        return self.handle_evolution_webhook(conn, self.read_json())

    def route_api(self, method: str, parsed: Any) -> Any:
        path = parsed.path
        query = parse_qs(parsed.query)
        with connect() as conn:
            if method == "POST" and path == "/api/login":
                data = self.read_json()
                login_name = normalize_username(data.get("username") or data.get("email"))
                user = conn.execute("SELECT * FROM users WHERE email = ? AND active = 1", (login_name,)).fetchone()
                if not user or not verify_password(data.get("password", ""), user["password_hash"]):
                    raise ApiError(HTTPStatus.UNAUTHORIZED, "Usuario ou senha invalidos.")
                token = secrets.token_urlsafe(32)
                expires_at = int(datetime.now().timestamp()) + SESSION_TTL_SECONDS
                conn.execute(
                    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                    (token, user["id"], expires_at, now_iso()),
                )
                cookie = session_cookie_header(token, SESSION_TTL_SECONDS)
                self.send_json(
                    HTTPStatus.OK,
                    {"user": public_user_payload(user)},
                    {"Set-Cookie": cookie},
                )
                return None

            if method == "POST" and path == "/api/logout":
                cookie = SimpleCookie(self.headers.get("Cookie"))
                token = cookie.get(SESSION_COOKIE)
                if token:
                    conn.execute("DELETE FROM sessions WHERE token = ?", (token.value,))
                self.send_json(HTTPStatus.OK, {"ok": True}, {"Set-Cookie": session_cookie_header("", 0)})
                return None

            if path.startswith("/api/internal/whatsapp"):
                return self.route_whatsapp_internal(conn, method, path, query)

            if path == "/api/evolution/webhook":
                return self.route_evolution_webhook(conn, method, query)

            user = self.current_user(conn)
            TENANT_CONTEXT[id(conn)] = user

            if method == "GET" and path == "/api/me":
                return {"user": user}
            if method == "POST" and path == "/api/me/password":
                return self.change_own_password(conn, user, self.read_json())
            if method == "GET" and path == "/api/super-admin/overview":
                self.require_super_admin(user)
                return self.super_admin_overview(conn)
            if method == "GET" and path == "/api/super-admin/tenants":
                self.require_super_admin(user)
                return {"tenants": self.super_admin_tenants(conn)}
            if method == "POST" and path == "/api/super-admin/tenants":
                self.require_super_admin(user)
                return self.create_tenant(conn, self.read_json())
            if method == "GET" and path == "/api/dashboard":
                return self.dashboard(conn, user)
            if method == "GET" and path == "/api/goals/my":
                return self.seller_goals_payload(
                    conn,
                    int(user["id"]),
                    coerce_int(query.get("year", ["0"])[0], 0),
                    coerce_int(query.get("month", ["0"])[0], 0),
                )
            if method == "GET" and path == "/api/customers":
                return {"customers": self.customers(conn, user, query.get("q", [""])[0])}
            if method == "POST" and path == "/api/customer-requests":
                return self.create_customer_request(conn, user, self.read_json())
            if method == "GET" and path == "/api/companies":
                return {"companies": self.companies(conn, user)}
            if method == "GET" and path == "/api/products":
                return {"products": self.products(conn, user, int(query.get("company_id", [0])[0] or 0), query.get("q", [""])[0])}
            if method == "POST" and path == "/api/proposals":
                return self.create_proposal(conn, user, self.read_json())
            if method == "GET" and path == "/api/proposals":
                return {"proposals": self.proposals(conn, user)}
            if method == "GET" and path.startswith("/api/proposals/") and path.endswith("/pdf"):
                proposal_id = int(path.split("/")[-2])
                content = self.proposal_pdf(conn, user, proposal_id)
                self.send_pdf(f"pedido-{proposal_id}.pdf", content)
                return None
            if method == "GET" and path == "/api/occurrences":
                return {"occurrences": self.occurrences(conn, user)}
            if method == "POST" and path == "/api/occurrences":
                return self.create_occurrence(conn, user, self.read_json())
            if method == "GET" and path.startswith("/api/occurrences/") and "/attachments/" in path:
                parts = path.strip("/").split("/")
                if len(parts) != 5 or parts[0] != "api" or parts[1] != "occurrences" or parts[3] != "attachments":
                    raise ApiError(HTTPStatus.NOT_FOUND, "Anexo nao encontrado.")
                self.send_occurrence_attachment(conn, user, int(parts[2]), int(parts[4]))
                return None
            if method == "GET" and path.startswith("/api/admin/customers/") and path.endswith("/performance/pdf"):
                self.require_admin(user)
                customer_id = int(path.split("/")[-3])
                report = self.customer_performance_report_data(conn, customer_id)
                customer_name = slugify(report["customer"].get("legal_name") or f"cliente-{customer_id}")
                content = self.customer_performance_pdf(report)
                self.send_pdf(f"analise-desempenho-{customer_name}.pdf", content)
                return None
            if method == "GET" and path == "/api/admin/summary":
                self.require_admin(user)
                return self.admin_summary(conn)
            if method == "GET" and path == "/api/admin/overview":
                self.require_admin(user)
                return self.admin_overview(conn)
            if method == "GET" and path == "/api/admin/customers":
                self.require_admin(user)
                return {
                    "customers": self.admin_customers(
                        conn,
                        query.get("q", [""])[0],
                        query.get("active", ["all"])[0],
                    )
                }
            if method == "GET" and path == "/api/admin/settings":
                self.require_admin(user)
                return self.admin_settings(conn)
            if method == "GET" and path == "/api/admin/goals":
                self.require_admin(user)
                return self.admin_goals(
                    conn,
                    coerce_int(query.get("year", ["0"])[0], 0),
                    coerce_int(query.get("month", ["0"])[0], 0),
                )
            if method == "GET" and path == "/api/admin/reports/pdf":
                self.require_admin(user)
                report_type = query.get("type", ["vendas"])[0]
                content = self.admin_report_pdf(conn, report_type, query)
                filename = f"relatorio-{slugify(report_type)}.pdf"
                self.send_pdf(filename, content)
                return None
            if method == "POST" and path == "/api/admin/goals":
                self.require_admin(user)
                return self.save_admin_goals(conn, self.read_json())
            if method == "POST" and path == "/api/admin/settings":
                self.require_admin(user)
                return self.save_admin_settings(conn, self.read_json())
            if method == "POST" and path == "/api/admin/settings/smtp/test":
                self.require_admin(user)
                return self.test_smtp_settings(self.read_json(), conn)
            if method == "POST" and path == "/api/admin/settings/whatsapp/connect":
                self.require_admin(user)
                return self.generate_whatsapp_qr(conn, self.read_json())
            if method == "POST" and path == "/api/admin/settings/whatsapp/disconnect":
                self.require_admin(user)
                return self.disconnect_whatsapp(conn)
            if method == "GET" and path == "/api/admin/companies":
                self.require_admin(user)
                return {
                    "companies": self.admin_companies(
                        conn,
                        query.get("q", [""])[0],
                        query.get("active", ["all"])[0],
                    )
                }
            if method == "POST" and path == "/api/admin/companies":
                self.require_admin(user)
                return self.create_company(conn, self.read_json())
            if method == "DELETE" and path.startswith("/api/admin/companies/"):
                self.require_admin(user)
                company_id = int(path.rsplit("/", 1)[-1])
                return self.delete_company(conn, company_id)
            if method == "PATCH" and path.startswith("/api/admin/companies/"):
                self.require_admin(user)
                company_id = int(path.rsplit("/", 1)[-1])
                return self.update_company(conn, company_id, self.read_json())
            if method == "GET" and path == "/api/admin/products":
                self.require_admin(user)
                return {
                    "products": self.admin_products(
                        conn,
                        query.get("company_id", [""])[0],
                        query.get("q", [""])[0],
                        query.get("active", ["all"])[0],
                    )
                }
            if method == "GET" and path == "/api/admin/products/export":
                self.require_admin(user)
                return self.export_products_csv(
                    conn,
                    query.get("company_id", [""])[0],
                    query.get("q", [""])[0],
                    query.get("active", ["all"])[0],
                )
            if method == "POST" and path == "/api/admin/products":
                self.require_admin(user)
                return self.create_product(conn, self.read_json())
            if method == "PATCH" and path.startswith("/api/admin/products/"):
                self.require_admin(user)
                product_id = int(path.rsplit("/", 1)[-1])
                return self.update_product(conn, product_id, self.read_json())
            if method == "DELETE" and path.startswith("/api/admin/products/"):
                self.require_admin(user)
                product_id = int(path.rsplit("/", 1)[-1])
                return self.delete_product(conn, product_id)
            if method == "POST" and path == "/api/admin/products/import":
                self.require_admin(user)
                return self.import_products(conn, self.read_json())
            if method == "GET" and path == "/api/admin/requests":
                self.require_admin(user)
                return {"requests": self.admin_requests(conn)}
            if method == "PATCH" and path.startswith("/api/admin/requests/"):
                self.require_admin(user)
                request_id = int(path.rsplit("/", 1)[-1])
                return self.update_registration_request(conn, request_id, self.read_json())
            if method == "GET" and path.startswith("/api/admin/occurrences/") and path.endswith("/pdf"):
                self.require_admin(user)
                occurrence_id = int(path.split("/")[-2])
                content = self.occurrence_pdf(conn, user, occurrence_id)
                self.send_pdf(f"ocorrencia-{occurrence_id}.pdf", content)
                return None
            if method == "PATCH" and path.startswith("/api/admin/occurrences/"):
                self.require_admin(user)
                occurrence_id = int(path.rsplit("/", 1)[-1])
                return self.update_occurrence(conn, occurrence_id, self.read_json())
            if method == "DELETE" and path.startswith("/api/admin/occurrences/"):
                self.require_admin(user)
                occurrence_id = int(path.rsplit("/", 1)[-1])
                return self.delete_occurrence(conn, occurrence_id)
            if method == "GET" and path == "/api/admin/outbox":
                self.require_admin(user)
                return {"outbox": self.admin_outbox(conn)}
            if method == "PATCH" and path.startswith("/api/admin/proposals/"):
                self.require_admin(user)
                proposal_id = int(path.rsplit("/", 1)[-1])
                return self.update_proposal_status(conn, user, proposal_id, self.read_json())
            if method == "DELETE" and path.startswith("/api/admin/proposals/"):
                self.require_admin(user)
                proposal_id = int(path.rsplit("/", 1)[-1])
                return self.delete_proposal(conn, proposal_id)
            if method == "POST" and path == "/api/admin/customers":
                self.require_admin(user)
                return self.create_customer(conn, self.read_json())
            if method == "PATCH" and path.startswith("/api/admin/customers/"):
                self.require_admin(user)
                customer_id = int(path.rsplit("/", 1)[-1])
                return self.update_customer(conn, customer_id, self.read_json())
            if method == "DELETE" and path.startswith("/api/admin/customers/"):
                self.require_admin(user)
                customer_id = int(path.rsplit("/", 1)[-1])
                return self.delete_customer(conn, customer_id)
            if method == "POST" and path == "/api/admin/assign-customer":
                self.require_admin(user)
                return self.assign_customer(conn, self.read_json())
            if method == "GET" and path == "/api/integrations/cnpj":
                exclude_raw = query.get("exclude_customer_id", [""])[0]
                exclude_id = int(exclude_raw) if str(exclude_raw).strip().isdigit() else None
                return self.lookup_cnpj(conn, query.get("cnpj", [""])[0], exclude_id)
            if method == "GET" and path == "/api/admin/users":
                self.require_admin(user)
                return {
                    "users": [
                        public_user_payload(row)
                        for row in conn.execute(
                            """
                            SELECT u.id, u.tenant_id, t.name AS tenant_name, u.name, u.email, u.communication_email, u.whatsapp_phone,
                                   u.role, u.is_super_admin, u.active, u.must_change_password, u.password_updated_at
                            FROM users u
                            LEFT JOIN tenants t ON t.id = u.tenant_id
                            WHERE u.tenant_id = ? AND COALESCE(u.is_super_admin, 0) = 0
                            ORDER BY u.name
                            """,
                            (current_tenant_id(conn),),
                        )
                    ]
                }
            if method == "GET" and path.startswith("/api/admin/users/") and path.endswith("/customers"):
                self.require_admin(user)
                parts = path.strip("/").split("/")
                seller_id = int(parts[3])
                return self.admin_user_customers(
                    conn,
                    seller_id,
                    query.get("q", [""])[0],
                    query.get("active", ["all"])[0],
                )
            if method == "GET" and path.startswith("/api/admin/users/") and path.endswith("/companies"):
                self.require_admin(user)
                parts = path.strip("/").split("/")
                seller_id = int(parts[3])
                return self.admin_user_companies(
                    conn,
                    seller_id,
                    query.get("q", [""])[0],
                    query.get("active", ["all"])[0],
                )
            if method == "POST" and path == "/api/admin/users":
                self.require_admin(user)
                return self.create_user(conn, self.read_json())
            if method == "PATCH" and path.startswith("/api/admin/users/"):
                self.require_admin(user)
                user_id = int(path.rsplit("/", 1)[-1])
                return self.update_user(conn, user_id, self.read_json())
            if method == "PATCH" and path == "/api/admin/customer-assignments":
                self.require_admin(user)
                return self.set_customer_assignment(conn, self.read_json())
            if method == "PATCH" and path == "/api/admin/company-assignments":
                self.require_admin(user)
                return self.set_company_assignment(conn, self.read_json())

        raise ApiError(HTTPStatus.NOT_FOUND, "Rota nao encontrada.")
