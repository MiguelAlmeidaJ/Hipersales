from __future__ import annotations

"""Formatação de mensagens, pedidos, datas e documentos PDF."""

try:
    from .foundation import *
except ImportError:  # Execução direta: python backend/app.py
    from foundation import *


def required(data: dict[str, Any], fields: list[str]) -> None:
    missing = [field for field in fields if data.get(field) in (None, "", [])]
    if missing:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Campos obrigatorios: " + ", ".join(missing))


def is_bonus_order_type(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    normalized = (
        normalized.replace("ç", "c")
        .replace("ã", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ú", "u")
    )
    return "bonificacao" in normalized


def tax_operator_invoice_label(value: Any) -> str:
    return "SIM, VIA OPERADOR FISCAL" if coerce_bool(value) else "NAO, DIRETO DA FABRICA"


OCCURRENCE_STATUS_LABELS = {
    "aberta": "Aberta",
    "em_analise": "Em analise",
    "em_tratamento": "Em analise",
    "recusada": "Recusada",
    "tratada": "Solucionada",
    "encerrada": "Solucionada",
    "solucionado": "Solucionada",
    "solucionada": "Solucionada",
}


def normalize_occurrence_status(value: Any) -> str:
    status = str(value or "").strip()
    if status in {"tratada", "encerrada", "solucionado"}:
        return "solucionada"
    if status == "em_tratamento":
        return "em_analise"
    if status in OCCURRENCE_STATUS_LABELS:
        return status
    return "aberta"


def occurrence_status_label(value: Any) -> str:
    return OCCURRENCE_STATUS_LABELS.get(str(value or ""), "Aberta")


def format_registration_email(user: dict[str, Any], data: dict[str, Any]) -> str:
    def pick(*keys: str) -> str:
        for key in keys:
            value = str(data.get(key, "") or "").strip()
            if value:
                return value
        return ""

    lines = [
        f"SOLICITACAO DE CADASTRO {pick('legal_name')}",
        "Ola, Bruna.",
        "",
        "Estamos fornecendo de forma automatica uma informacao diretamente do HiperSales Web.",
        f"A solicitacao foi enviada pelo representante comercial {user['name']} <{user.get('communication_email') or user['email']}>.",
        "",
        f"Razao social: {pick('legal_name')}",
        f"Nome fantasia: {pick('trade_name')}",
        f"CNPJ: {pick('cnpj')}",
        f"Inscricao estadual: {pick('state_registration')}",
        f"Endereco: {pick('address')}",
        f"Cidade: {pick('city')}",
        f"UF: {pick('state')}",
        f"CEP: {pick('zip_code')}",
        f"Pessoa de contato: {pick('contact_person', 'buyer_name')}",
        f"Telefone 1: {pick('phone_1', 'phone', 'buyer_phone_1')}",
        f"Telefone 2: {pick('phone_2', 'buyer_phone_2')}",
        f"E-mail compras: {pick('purchase_email', 'buyer_email', 'email')}",
        f"E-mail envio boletos: {pick('billing_email')}",
        f"E-mail XML: {pick('xml_email')}",
        f"Entrega agendada: {pick('delivery_scheduled', 'scheduling')}",
        f"Como agendar: {pick('schedule_method', 'scheduling_how')}",
        f"Advertencias para Recebimento: {pick('delivery_warnings', 'notes')}",
        "",
        "Por favor, validar na retaguarda do HiperSales Web para transformar esta solicitacao em cadastro.",
        "",
        "Atenciosamente,",
        "Comunicacao HiperSales Web",
    ]
    return "\n".join(lines)


def proposal_email_payload(conn: sqlite3.Connection, proposal_id: int) -> tuple[dict[str, Any], list[sqlite3.Row]]:
    proposal_row = conn.execute(
        """
        SELECT p.*, u.name AS seller_name,
               COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
               u.whatsapp_phone AS seller_whatsapp_phone,
               c.legal_name AS customer_name, c.trade_name AS customer_trade_name,
               c.cnpj, c.state_registration, c.address, c.email AS customer_email,
               co.name AS company_name
        FROM proposals p
        JOIN users u ON u.id = p.seller_id
        JOIN customers c ON c.id = p.customer_id
        JOIN companies co ON co.id = p.company_id
        WHERE p.id = ?
        """,
        (proposal_id,),
    ).fetchone()
    if not proposal_row:
        raise ApiError(HTTPStatus.NOT_FOUND, "Proposta nao encontrada.")
    proposal = dict(proposal_row)
    items = conn.execute(
        """
        SELECT pi.quantity, pi.negotiated_price, pr.code, pr.name, pr.unit
        FROM proposal_items pi
        JOIN products pr ON pr.id = pi.product_id
        WHERE pi.proposal_id = ?
        ORDER BY pi.id
        """,
        (proposal_id,),
    ).fetchall()
    return proposal, items


def format_proposal_subject(conn: sqlite3.Connection, proposal_id: int, prefix: str) -> str:
    proposal, _ = proposal_email_payload(conn, proposal_id)
    return f"{prefix} {proposal['customer_name']} + {proposal['cnpj']}"


def format_datetime_parts(value: str | None) -> tuple[str, str]:
    if not value:
        return "", ""
    try:
        parsed = parse_report_datetime(value)
    except ValueError:
        return str(value), ""
    return parsed.strftime("%d/%m/%Y"), parsed.strftime("%H:%M")


def format_new_proposal_email(conn: sqlite3.Connection, proposal_id: int) -> str:
    proposal, _ = proposal_email_payload(conn, proposal_id)
    return "\n".join([
        "Ola, Thalles.",
        f"Voce esta recebendo uma nova proposta enviada por {proposal['seller_name']} para analise do cliente {proposal['customer_name']} - CNPJ {proposal['cnpj']}.",
        "Por favor, verificar na plataforma do administrador para dar andamento a analise.",
        "Atenciosamente,",
        "Comunicacao HiperSales Web",
    ])


def format_approved_order_email(conn: sqlite3.Connection, proposal_id: int) -> str:
    proposal, items = proposal_email_payload(conn, proposal_id)
    sent_date, sent_time = format_datetime_parts(proposal["created_at"])
    lines = [
        "Ola, Bruna.",
        f"Foi aprovada a proposta do cliente {proposal['customer_name']}.",
        "Agora a proposta se tornou um pedido e podemos dar continuidade na operacao.",
        f"Solicito que transmita o pedido abaixo para a Empresa {proposal['company_name']} de acordo com as regras internas dela (aplicativo, formulario, e-mail).",
        "Para facilitar seu trabalho estarei enviando abaixo as informacoes do pedido.",
        "",
        "Cabecalho do Pedido:",
        f"Data: {sent_date}",
        f"Horario: {sent_time}",
        f"Usuario: {proposal['seller_name']}",
        f"Empresa: {proposal['company_name']}",
        f"Cliente: {proposal['customer_name']}",
        f"CNPJ: {proposal['cnpj']}",
        f"Endereco: {proposal['address'] or ''}",
        f"Nota Fiscal via Operador Fiscal: {tax_operator_invoice_label(proposal.get('tax_operator_invoice'))}",
        "Condicoes do Pedido:",
        f"Natureza da Operacao: {proposal['order_type']}",
        f"Frete: {proposal['freight_type']}",
        f"Tipo de Entrega: {proposal['delivery_type']}",
        f"Data Programada Entrega: {proposal['scheduled_delivery_date'] or ''}",
        f"Ordem de Compras Cliente: {proposal['purchase_order'] or ''}",
        f"Forma de Pagamento: {proposal['payment_terms']}",
        f"%Desconto: {float(proposal['discount_percent'] or 0):.2f}",
        f"Desconto em: {normalize_discount_on(proposal.get('discount_on'))}",
        f"%Comissao: {float(proposal['commission_percent'] or 0):.2f}",
        f"Observacao do Pedido: {proposal['notes'] or ''}",
        "Itens do Pedido:",
    ]
    for index, item in enumerate(items, start=1):
        lines.extend([
            f"Item {index:02d}: {item['code']}",
            f"Produto: {item['name']}",
            f"Unidade Venda: {item['unit'] or 'UN'}",
            f"Quantidade: {item['quantity']}",
            f"Preco Negociado: {format_brl(item['negotiated_price'])}",
        ])
    lines.extend([
        "",
        "Bruna,",
        f"E muito importante que apos enviar este pedido para a Empresa {proposal['company_name']} voce va ate a plataforma do administrador (HiperSales Web) e atualize o Status do Pedido para que {proposal['seller_name']} tenha acesso ao andamento do pedido.",
        "",
        "Atenciosamente,",
        "Comunicacao HiperSales Web",
    ])
    return "\n".join(lines)


def format_rejected_proposal_email(conn: sqlite3.Connection, proposal_id: int) -> str:
    proposal, _ = proposal_email_payload(conn, proposal_id)
    return "\n".join([
        f"Ola, {proposal['seller_name']}.",
        f"Voce transmitiu uma proposta do cliente {proposal['customer_name']} - CNPJ {proposal['cnpj']}.",
        "Devido a inconsistencias ela nao foi aprovada.",
        "Houve algum erro na digitacao, escolha de condicao comercial, preco nao deve estar de acordo ou algum outro motivo.",
        "Sugerimos que faca contato para averiguar ao certo o motivo da recusa da proposta enviada.",
        "Importante dizer que neste momento nao estamos considerando a proposta enviada e seu contato e de suma importancia para manter agilidade no atendimento ao cliente.",
        "Atenciosamente,",
        "Comunicacao HiperSales Web",
    ])


def format_status_email_message(context: dict[str, str]) -> str:
    vendedor = context.get("vendedor", "")
    cliente = context.get("cliente", "")
    cnpj = context.get("cnpj", "")
    pedido_id = context.get("pedido_id", "")
    status = str(context.get("status") or "")
    status_label = str(context.get("status_label") or "").strip()
    delivery_forecast = str(context.get("delivery_forecast") or "").strip()
    notes = str(context.get("observacoes") or "").strip()
    lines = [
        f"Ola, {vendedor} 😀",
        "",
        "Estamos fornecendo de forma automatica uma informacao diretamente do HiperSales Web.",
        f"O pedido nº #{pedido_id} referente ao cliente {cliente} + {cnpj} teve uma atualizacao de status.",
        f"Seu pedido encontra-se {status_label.upper() if status_label else status.upper()}",
    ]
    if status == "pedido_aprovado" and delivery_forecast:
        lines.append(f"Entrega prevista: {delivery_forecast}")
    if notes:
        lines.extend(["", f"Observacoes: {notes}"])
    lines.extend([
        "",
        'Voce pode acompanhar a atualizacao dos seus pedidos através do Software HiperSales Web - selecionando a opcao "consultar pedidos" na tela inicial.',
        "",
        "Em breve volto com mais atualizacoes sobre seus pedidos!",
        f"Otimas vendas, ate mais {vendedor}!",
    ])
    return "\n".join(lines)


def status_email_subject_label(status: str) -> str:
    return {
        "pedido_aprovado": "APROVADO",
        "em_producao": "EM PRODUÇÃO",
        "faturado": "FATURADO",
        "entregue": "ENTREGUE",
    }.get(status, STATUS_LABELS.get(status, status).upper())


def format_status_whatsapp_message(context: dict[str, str]) -> str:
    vendedor = context.get("vendedor", "")
    cliente = context.get("cliente", "")
    cnpj = context.get("cnpj", "")
    pedido_id = context.get("pedido_id", "")
    status = str(context.get("status") or "")
    status_label = str(context.get("status_label") or "").strip()
    status_display = {
        "pedido_aprovado": "APROVADO",
        "em_producao": "EM PRODUÇÃO",
        "faturado": "FATURADO",
        "entregue": "ENTREGUE",
        "recusado": "RECUSADO",
    }.get(status, status_label.upper() if status_label else "ATUALIZADO")

    intro = [
        f"Ola, {vendedor} 😀",
        "",
        "Estamos fornecendo de forma automatica uma informacao diretamente do HiperSales Web.",
    ]

    if status == "em_analise":
        return "\n".join([
            *intro,
            f"O pedido nº #{pedido_id} referente ao cliente {cliente} + {cnpj} foi recebido com sucesso e já está em análise.",
            "",
            'Você poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção "consultar pedidos" na tela inicial.',
            "",
            "Em breve volto com mais atualizações sobre seus pedidos!",
            f"Ótimas vendas, até mais {vendedor}!",
        ])

    return "\n".join([
        *intro,
        f"O pedido nº #{pedido_id} referente ao cliente {cliente} + {cnpj} teve uma atualização em seu status.",
        "",
        f"Seu pedido encontra-se {status_display}",
        "",
        'Você poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção "consultar pedidos" na tela inicial.',
        "",
        "Em breve volto com mais atualizações sobre seus pedidos!",
        f"Ótimas vendas, até mais {vendedor}!",
    ])


def professional_order_pdf(proposal: dict[str, Any], order_statuses: list[dict[str, str]] | None = None) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
        title=f"Pedido #{proposal.get('order_number') or proposal.get('id')}",
        author="HiperSales Web",
    )

    navy = colors.HexColor("#12305a")
    blue = colors.HexColor("#1268c5")
    teal = colors.HexColor("#0f8f87")
    ink = colors.HexColor("#1f2d3d")
    muted = colors.HexColor("#5f6f82")
    line = colors.HexColor("#d9e3ef")
    soft = colors.HexColor("#f4f7fb")
    soft_blue = colors.HexColor("#eaf3ff")
    success_soft = colors.HexColor("#e8f7f2")

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=21,
        textColor=navy,
        alignment=TA_RIGHT,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=navy,
        spaceBefore=8,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Small",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=muted,
    ))
    styles.add(ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=ink,
    ))
    styles.add(ParagraphStyle(
        name="BodyBold",
        parent=styles["Body"],
        fontName="Helvetica-Bold",
        textColor=navy,
    ))
    styles.add(ParagraphStyle(
        name="Right",
        parent=styles["Body"],
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="Center",
        parent=styles["Body"],
        alignment=TA_CENTER,
    ))

    def text(value: Any) -> str:
        return escape(str(value or ""))

    def para(value: Any, style: str = "Body") -> Paragraph:
        return Paragraph(text(value), styles[style])

    def label_value(label: str, value: Any) -> Paragraph:
        return Paragraph(f"<font color='#5f6f82'>{escape(label)}</font><br/><b>{text(value) or '-'}</b>", styles["Body"])

    def pct(value: Any) -> str:
        try:
            return f"{float(value or 0):.2f}%".replace(".", ",")
        except (TypeError, ValueError):
            return "0,00%"

    def money(value: Any) -> str:
        try:
            return format_brl(float(value or 0))
        except (TypeError, ValueError):
            return format_brl(0)

    status_colors = {item.get("key"): item.get("color") for item in (order_statuses or []) if isinstance(item, dict)}

    def status_label(value: Any) -> str:
        return STATUS_LABELS.get(str(value or ""), str(value or ""))

    def readable_text_color(hex_color: str) -> Any:
        raw = hex_color.lstrip("#")
        try:
            red = int(raw[0:2], 16)
            green = int(raw[2:4], 16)
            blue_value = int(raw[4:6], 16)
        except (ValueError, IndexError):
            return colors.white
        luminance = (red * 299 + green * 587 + blue_value * 114) / 1000
        return navy if luminance > 150 else colors.white

    def status_palette(value: Any) -> tuple[Any, Any]:
        configured = status_colors.get(str(value or ""))
        if configured:
            background = colors.HexColor(configured)
            return background, readable_text_color(configured)
        status = str(value or "")
        if status in {"pedido_aprovado", "em_producao", "faturado", "entregue"}:
            return success_soft, teal
        if status == "recusado":
            return colors.HexColor("#fdecec"), colors.HexColor("#b42318")
        return soft_blue, blue

    story: list[Any] = []
    logo_path = FRONTEND_DIR / "assets" / "logoweb.png"
    if not logo_path.exists():
        logo_path = FRONTEND_DIR / "assets" / "logoapp.png"
    logo = Image(str(logo_path), width=58 * mm, height=15 * mm) if logo_path.exists() else para("HiperSales Web", "BodyBold")

    badge_bg, badge_fg = status_palette(proposal.get("status"))
    header_right = [
        [Paragraph("ORDEM DE PEDIDO", styles["DocTitle"])],
        [Paragraph(f"Pedido #{proposal.get('order_number') or proposal.get('id')} | Emitido em {format_datetime_for_pdf(proposal.get('created_at'))}", styles["Right"])],
        [Table(
            [[Paragraph(f"<b>{text(status_label(proposal.get('status'))).upper()}</b>", styles["Center"])]],
            colWidths=[46 * mm],
            style=[
                ("BACKGROUND", (0, 0), (-1, -1), badge_bg),
                ("TEXTCOLOR", (0, 0), (-1, -1), badge_fg),
                ("BOX", (0, 0), (-1, -1), 0.6, badge_fg),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ],
        )],
    ]
    header = Table(
        [[logo, Table(header_right, colWidths=[86 * mm])]],
        colWidths=[78 * mm, 86 * mm],
        style=[
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("LINEBELOW", (0, 0), (-1, -1), 1.2, navy),
        ],
    )
    story.append(header)
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Dados do Pedido", styles["SectionTitle"]))
    order_data = [
        [
            label_value("Empresa", proposal.get("company_name")),
            label_value("Representante comercial", proposal.get("seller_name")),
            label_value("Entrega prevista", format_date_for_pdf(proposal.get("delivery_forecast")) or "-"),
        ],
        [
            label_value("Pedido na Industria", proposal.get("industry_order_number") or "-"),
            label_value("Nota Fiscal", proposal.get("invoice_number") or "-"),
            label_value("Status atual", status_label(proposal.get("status"))),
        ],
        [
            label_value("Cliente", proposal.get("customer_name")),
            label_value("Nome fantasia", proposal.get("customer_trade_name")),
            label_value("CNPJ", proposal.get("customer_cnpj")),
        ],
        [
            label_value("Inscricao Estadual", proposal.get("customer_state_registration")),
            label_value("E-mail", proposal.get("customer_email")),
            label_value("Telefone", proposal.get("customer_phone")),
        ],
        [
            Paragraph(f"<font color='#5f6f82'>Endereco completo</font><br/><b>{text(proposal.get('customer_address') or '-')}</b>", styles["Body"]),
            "",
            "",
        ],
    ]
    order_table = Table(order_data, colWidths=[54.6 * mm, 54.6 * mm, 54.6 * mm])
    order_table.setStyle(TableStyle([
        ("SPAN", (0, 4), (-1, 4)),
        ("BACKGROUND", (0, 0), (-1, -1), soft),
        ("BOX", (0, 0), (-1, -1), 0.6, line),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, line),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(order_table)

    story.append(Paragraph("Condicoes Comerciais", styles["SectionTitle"]))
    conditions = [
        [
            label_value("Natureza da Operacao", proposal.get("order_type")),
            label_value("Frete", proposal.get("freight_type")),
            label_value("Tipo de Entrega", proposal.get("delivery_type")),
        ],
        [
            label_value("Data Programada", format_date_for_pdf(proposal.get("scheduled_delivery_date")) or "-"),
            label_value("Ordem de Compra do Cliente", proposal.get("purchase_order") or "-"),
            label_value("Forma de Pagamento", proposal.get("payment_terms")),
        ],
        [
            label_value("Desconto", pct(proposal.get("discount_percent"))),
            label_value("Desconto em", normalize_discount_on(proposal.get("discount_on"))),
            label_value("Comissao", pct(proposal.get("commission_percent"))),
        ],
    ]
    conditions_table = Table(conditions, colWidths=[54.6 * mm, 54.6 * mm, 54.6 * mm])
    conditions_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, line),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, line),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(conditions_table)

    story.append(Paragraph("Itens do Pedido", styles["SectionTitle"]))
    item_rows = [[
        para("Item", "BodyBold"),
        para("Codigo", "BodyBold"),
        para("Produto", "BodyBold"),
        para("Un.", "BodyBold"),
        para("Qtd.", "BodyBold"),
        para("Preco", "BodyBold"),
        para("Subtotal", "BodyBold"),
    ]]
    total = 0.0
    for index, item in enumerate(proposal.get("items") or [], start=1):
        quantity = float(item.get("quantity") or 0)
        price = float(item.get("negotiated_price") or 0)
        subtotal = quantity * price
        total += subtotal
        item_rows.append([
            para(f"{index:02d}", "Center"),
            para(item.get("code"), "Body"),
            para(item.get("name"), "Body"),
            para(item.get("unit") or "UN", "Center"),
            para(f"{quantity:g}".replace(".", ","), "Right"),
            para(money(price), "Right"),
            para(money(subtotal), "Right"),
        ])
    if len(item_rows) == 1:
        item_rows.append(["", "", para("Nenhum item informado.", "Body"), "", "", "", ""])
    item_rows.append(["", "", "", "", "", para("Total", "BodyBold"), para(money(total), "Right")])
    items_table = Table(item_rows, colWidths=[11 * mm, 23 * mm, 66 * mm, 13 * mm, 16 * mm, 18 * mm, 18 * mm], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -2), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#fbfdff")]),
        ("BACKGROUND", (5, -1), (-1, -1), soft_blue),
        ("SPAN", (0, -1), (4, -1)),
        ("BOX", (0, 0), (-1, -1), 0.6, line),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(items_table)

    if proposal.get("notes"):
        story.append(Paragraph("Observacoes", styles["SectionTitle"]))
        notes_table = Table([[para(proposal.get("notes"), "Body")]], colWidths=[164 * mm])
        notes_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), soft),
            ("BOX", (0, 0), (-1, -1), 0.6, line),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(notes_table)

    timeline = proposal.get("timeline") or []
    if timeline:
        story.append(Paragraph("Linha do Tempo", styles["SectionTitle"]))
        timeline_rows = []
        for event in timeline:
            title = status_label(event.get("status")) or event.get("title") or "Atualizacao"
            note = f"<br/><font color='#5f6f82'>{text(event.get('notes'))}</font>" if event.get("notes") else ""
            if event.get("status") == "pedido_aprovado" and proposal.get("delivery_forecast"):
                note += f"<br/><font color='#0f8f87'><b>Entrega prevista: {text(format_date_for_pdf(proposal.get('delivery_forecast')))}</b></font>"
            timeline_rows.append([
                para(format_datetime_for_pdf(event.get("created_at")), "Small"),
                Paragraph(f"<b>{text(title)}</b>{note}", styles["Body"]),
                para(event.get("created_by_name") or "Sistema", "Small"),
            ])
        timeline_table = Table(timeline_rows, colWidths=[29 * mm, 103 * mm, 32 * mm])
        timeline_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.append(timeline_table)

    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(
        "Documento gerado automaticamente pelo HiperSales Web. Confira as condicoes comerciais antes da transmissao do pedido.",
        styles["Small"],
    ))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(line)
        canvas.line(document.leftMargin, 10 * mm, A4[0] - document.rightMargin, 10 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(muted)
        canvas.drawString(document.leftMargin, 6 * mm, "HiperSales Web")
        canvas.drawRightString(A4[0] - document.rightMargin, 6 * mm, f"Pagina {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def professional_order_pdf_v2(proposal: dict[str, Any], order_statuses: list[dict[str, str]] | None = None) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
    from xml.sax.saxutils import escape

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=5 * mm,
        leftMargin=5 * mm,
        topMargin=4 * mm,
        bottomMargin=4 * mm,
        title=f"Pedido #{proposal.get('order_number') or proposal.get('id')}",
        author="HiperSales Web",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="DocTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=15.5, leading=18, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="DocMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=10, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, leading=14, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="Field", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=13))
    styles.add(ParagraphStyle(name="FieldLabel", parent=styles["Field"], fontName="Helvetica-Bold"))

    def text(value: Any) -> str:
        return escape(str(value or ""))

    def upper(value: Any) -> str:
        value = str(value or "").strip()
        return value.upper() if value else "-"

    def pct_short(value: Any) -> str:
        try:
            number = float(value or 0)
            if number.is_integer():
                return f"{int(number)}%"
            return f"{number:.2f}%".replace(".", ",")
        except (TypeError, ValueError):
            return "0%"

    def money(value: Any) -> str:
        try:
            return format_brl(float(value or 0))
        except (TypeError, ValueError):
            return format_brl(0)

    def field(label: str, value: Any, with_colon: bool = False) -> Paragraph:
        suffix = ":" if with_colon else ""
        return Paragraph(f"<b>{escape(label)}{suffix}</b><br/>{text(value) or '-'}", styles["Field"])

    def field_table(rows: list[list[Paragraph]], widths: list[float], height: float) -> Table:
        table = Table(rows, colWidths=widths, rowHeights=[height] * len(rows))
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return table

    def item_cell(value: Any, bold: bool = False) -> Paragraph:
        style = ParagraphStyle(
            name=f"Item{'Bold' if bold else 'Body'}",
            parent=styles["Normal"],
            fontName="Helvetica-Bold" if bold else "Helvetica",
            fontSize=8.5,
            leading=10,
        )
        return Paragraph(text(value), style)

    page_width = 200 * mm
    col4 = [45 * mm, 60 * mm, 47 * mm, 48 * mm]

    emitted_by = proposal.get("seller_username") or proposal.get("seller_name") or "usuario"
    if isinstance(emitted_by, str) and "@" in emitted_by:
        emitted_by = emitted_by.split("@", 1)[0]

    title = Table(
        [[
            [
                Paragraph("PEDIDO DE VENDA", styles["DocTitle"]),
                Paragraph(f"Emitido em {text(format_datetime_for_pdf(proposal.get('created_at')))} por {text(emitted_by)}", styles["DocMeta"]),
            ],
        ]],
        colWidths=[page_width],
        rowHeights=[16 * mm],
    )
    title.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    header_fields = field_table(
        [[
            field("Empresa", upper(proposal.get("company_name")), True),
            field("Representante Comercial", upper(proposal.get("seller_name"))),
            field("Status do Pedido", upper(STATUS_LABELS.get(str(proposal.get("status") or ""), str(proposal.get("status") or "")))),
            field("Entrega Prevista", format_date_for_pdf(proposal.get("delivery_forecast")) or "-"),
        ]],
        col4,
        22 * mm,
    )
    customer_top = field_table(
        [[
            field("Razão Social", upper(proposal.get("customer_name"))),
            field("Nome Fantasia", upper(proposal.get("customer_trade_name"))),
            field("CNPJ", proposal.get("customer_cnpj") or "-"),
        ]],
        [75 * mm, 77 * mm, 48 * mm],
        18 * mm,
    )
    customer_bottom = field_table(
        [[
            field("Endereço", upper(proposal.get("customer_address"))),
            field("Insc. Estadual", proposal.get("customer_state_registration") or "-"),
        ]],
        [152 * mm, 48 * mm],
        20 * mm,
    )
    commercial_top = field_table(
        [[
            field("Natureza da Operação", upper(proposal.get("order_type"))),
            field("Frete", upper(proposal.get("freight_type"))),
            field("Tipo de Entrega", upper(proposal.get("delivery_type"))),
            field("Dt. Programada Entrega", format_date_for_pdf(proposal.get("scheduled_delivery_date")) or "-"),
        ]],
        [60 * mm, 62 * mm, 30 * mm, 48 * mm],
        19 * mm,
    )
    commercial_bottom = field_table(
        [[
            field("Ordem de Compra Cliente", proposal.get("purchase_order") or "-"),
            field("Condição de Pagamento", upper(proposal.get("payment_terms"))),
            field("%Desconto", pct_short(proposal.get("discount_percent"))),
            field("Desconto em", upper(normalize_discount_on(proposal.get("discount_on")))),
        ]],
        [60 * mm, 62 * mm, 30 * mm, 48 * mm],
        19 * mm,
    )
    fiscal_operator = field_table(
        [[
            field("Nota Fiscal via Operador Fiscal?", tax_operator_invoice_label(proposal.get("tax_operator_invoice"))),
        ]],
        [page_width],
        15 * mm,
    )
    notes_value = str(proposal.get("notes") or "").strip() or " "
    observations = Table(
        [[Paragraph(text(notes_value).replace("\n", "<br/>"), styles["Field"])]],
        colWidths=[page_width],
    )
    observations.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    item_rows: list[list[Any]] = [[
        item_cell("Código", True),
        item_cell("Descrição do Produto", True),
        item_cell("Unidade", True),
        item_cell("Qtd Pedido", True),
        item_cell("Preço", True),
        item_cell("SubTotal", True),
    ]]
    total = 0.0
    for item in proposal.get("items") or []:
        quantity = float(item.get("quantity") or 0)
        price = float(item.get("negotiated_price") or 0)
        subtotal = quantity * price
        total += subtotal
        item_rows.append([
            item_cell(item.get("code") or "-"),
            item_cell(upper(item.get("name"))),
            item_cell(upper(item.get("unit") or "UN")),
            item_cell(f"{quantity:g}".replace(".", ",")),
            item_cell(money(price)),
            item_cell(money(subtotal)),
        ])
    if len(item_rows) == 1:
        item_rows.append(["", item_cell("Nenhum item informado."), "", "", "", ""])
    item_rows.append(["", "", "", item_cell("Valor Total do Pedido", True), "", item_cell(money(total), True)])
    items_table = Table(item_rows, colWidths=[15 * mm, 74 * mm, 32 * mm, 28 * mm, 17 * mm, 34 * mm])
    total_row_index = len(item_rows) - 1
    items_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "CENTER"),
        ("ALIGN", (5, 1), (5, -1), "RIGHT"),
        ("SPAN", (0, total_row_index), (2, total_row_index)),
        ("SPAN", (3, total_row_index), (4, total_row_index)),
        ("ALIGN", (3, total_row_index), (5, total_row_index), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    data = [
        [title],
        [Paragraph("Cabeçalho", styles["SectionTitle"])],
        [header_fields],
        [Paragraph("Cliente", styles["SectionTitle"])],
        [customer_top],
        [customer_bottom],
        [Paragraph("Condições Comerciais", styles["SectionTitle"])],
        [commercial_top],
        [commercial_bottom],
        [fiscal_operator],
        [Paragraph("Observações do Pedido", styles["SectionTitle"])],
        [observations],
        [Paragraph("Itens do Pedido", styles["SectionTitle"])],
        [items_table],
    ]
    pdf = Table(data, colWidths=[page_width])
    pdf.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("LINEBELOW", (0, 0), (-1, -2), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 1), (0, 1), "CENTER"),
        ("ALIGN", (0, 3), (0, 3), "CENTER"),
        ("ALIGN", (0, 6), (0, 6), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    doc.build([pdf])
    return buffer.getvalue()


def proposal_pdf_lines(proposal: dict[str, Any]) -> list[str]:
    lines = [
        f"PEDIDO #{proposal.get('order_number') or proposal.get('id')}",
        "HiperSales Web",
        "",
        "CABECALHO",
        f"Data emissao: {format_datetime_for_pdf(proposal.get('created_at'))}",
        f"Representante comercial: {proposal.get('seller_name') or ''}",
        f"Empresa: {proposal.get('company_name') or ''}",
        f"Cliente: {proposal.get('customer_name') or ''}",
        f"CNPJ: {proposal.get('customer_cnpj') or ''}",
        f"Inscricao Estadual: {proposal.get('customer_state_registration') or ''}",
        f"Endereco: {proposal.get('customer_address') or ''}",
        f"Status atual: {STATUS_LABELS.get(proposal.get('status'), proposal.get('status') or '')}",
        f"Entrega prevista: {format_date_for_pdf(proposal.get('delivery_forecast'))}",
        f"Pedido na Industria: {proposal.get('industry_order_number') or ''}",
        f"Nota Fiscal: {proposal.get('invoice_number') or ''}",
        f"Nota Fiscal via Operador Fiscal: {tax_operator_invoice_label(proposal.get('tax_operator_invoice'))}",
        "",
        "CONDICOES DO PEDIDO",
        f"Natureza da Operacao: {proposal.get('order_type') or ''}",
        f"Frete: {proposal.get('freight_type') or ''}",
        f"Tipo de Entrega: {proposal.get('delivery_type') or ''}",
        f"Data Programada Entrega: {format_date_for_pdf(proposal.get('scheduled_delivery_date'))}",
        f"Ordem de Compras Cliente: {proposal.get('purchase_order') or ''}",
        f"Forma de Pagamento: {proposal.get('payment_terms') or ''}",
        f"Desconto: {proposal.get('discount_percent') or 0}%",
        f"Desconto em: {normalize_discount_on(proposal.get('discount_on'))}",
        f"Comissao: {proposal.get('commission_percent') or 0}%",
        f"Observacao: {proposal.get('notes') or ''}",
        "",
        "ITENS DO PEDIDO",
    ]
    total = 0.0
    for index, item in enumerate(proposal.get("items") or [], start=1):
        subtotal = float(item.get("quantity") or 0) * float(item.get("negotiated_price") or 0)
        total += subtotal
        lines.extend([
            f"Item {index:02d}: {item.get('code') or ''}",
            f"Produto: {item.get('name') or ''}",
            f"Unidade Venda: {item.get('unit') or 'UN'}",
            f"Quantidade: {item.get('quantity') or ''}",
            f"Preco Negociado: {format_brl(float(item.get('negotiated_price') or 0))}",
            f"Subtotal: {format_brl(subtotal)}",
            "",
        ])
    lines.extend([
        f"TOTAL: {format_brl(total)}",
        "",
        "LINHA DO TEMPO",
    ])
    for event in proposal.get("timeline") or []:
        lines.append(f"{format_datetime_for_pdf(event.get('created_at'))} - {STATUS_LABELS.get(event.get('status'), event.get('title') or event.get('status') or '')}")
        if event.get("notes"):
            lines.append(f"  {event.get('notes')}")
    return lines


def format_datetime_for_pdf(value: Any) -> str:
    if not value:
        return ""
    try:
        parsed = parse_report_datetime(value)
        return parsed.strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return str(value)


def format_date_for_pdf(value: Any) -> str:
    if not value:
        return ""
    try:
        raw = str(value).strip()
        if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
            return datetime.fromisoformat(raw[:10]).strftime("%d/%m/%Y")
        parsed = parse_report_datetime(value)
        return parsed.strftime("%d/%m/%Y")
    except ValueError:
        return str(value)


def parse_report_datetime(value: Any) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(REPORT_TIMEZONE)


PAYMENT_TERM_AVERAGE_DAYS: dict[str, float] = {
    "a vista": 0.0,
    "à vista": 0.0,
    "pagamento antecipado": 0.0,
    "boleto 7 dias": 7.0,
    "boleto 7/14 dias": 10.5,
    "boleto 7/14/21 dias": 14.0,
    "boleto 14 dias": 14.0,
    "boleto 14/21 dias": 17.5,
    "boleto 14/21/28 dias": 21.0,
    "boleto 14/21/28/35 dias": 24.5,
    "boleto 21 dias": 21.0,
    "boleto 21/28 dias": 24.5,
    "boleto 21/28/35 dias": 28.0,
    "boleto 21/28/35/42 dias": 31.5,
    "boleto 21/28/35/42/49 dias": 35.0,
    "boleto 28 dias": 28.0,
    "boleto 28/35 dias": 31.5,
    "boleto 28/35/42 dias": 35.0,
    "boleto 28/35/42/49 dias": 38.5,
    "boleto 35 dias": 35.0,
    "boleto 35/42/49 dias": 42.0,
    "boleto 42 dias": 42.0,
    "boleto 45 dias": 45.0,
    "boleto 49 dias": 49.0,
    "boleto 56 dias": 56.0,
    "boleto 60 dias": 60.0,
    "boleto 90 dias": 90.0,
}


def payment_term_days(value: Any) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    configured = PAYMENT_TERM_AVERAGE_DAYS.get(raw.lower())
    if configured is not None:
        return configured
    if "antecip" in raw.lower():
        return 0.0
    matches = re.findall(r"\d+", raw)
    if not matches:
        return 0.0
    numbers = [int(match) for match in matches if match.isdigit()]
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)


def format_decimal_pt(value: Any) -> str:
    try:
        numeric = round(float(value or 0), 2)
    except (TypeError, ValueError):
        return "0"
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def pdf_escape(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def simple_pdf(lines: list[str]) -> bytes:
    page_width = 595
    page_height = 842
    margin_x = 42
    start_y = 800
    line_height = 15
    max_lines = 48
    pages = [lines[index:index + max_lines] for index in range(0, len(lines), max_lines)] or [[]]
    objects: list[bytes] = []
    page_refs: list[int] = []

    def add_object(content: bytes) -> int:
        objects.append(content)
        return len(objects)

    font_ref = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    bold_ref = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    for page_lines in pages:
        commands = ["BT", f"/F{bold_ref} 16 Tf", f"{margin_x} {start_y} Td", f"({pdf_escape(page_lines[0] if page_lines else 'Pedido')}) Tj"]
        y_lines = page_lines[1:] if page_lines else []
        commands.append(f"/F{font_ref} 10 Tf")
        for line in y_lines:
            commands.append(f"0 -{line_height} Td ({pdf_escape(line[:105])}) Tj")
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", errors="replace")
        content_ref = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
        page_ref = add_object(
            f"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Resources << /Font << /F{font_ref} {font_ref} 0 R /F{bold_ref} {bold_ref} 0 R >> >> "
            f"/Contents {content_ref} 0 R >>".encode()
        )
        page_refs.append(page_ref)

    pages_ref = add_object(
        f"<< /Type /Pages /Kids [{' '.join(f'{ref} 0 R' for ref in page_refs)}] /Count {len(page_refs)} >>".encode()
    )
    catalog_ref = add_object(f"<< /Type /Catalog /Pages {pages_ref} 0 R >>".encode())
    for ref in page_refs:
        objects[ref - 1] = objects[ref - 1].replace(b"/Parent 0 0 R", f"/Parent {pages_ref} 0 R".encode())

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, content in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode())
        output.extend(content)
        output.extend(b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_ref} 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(output)


def format_proposal_email(conn: sqlite3.Connection, proposal_id: int) -> str:
    proposal, items = proposal_email_payload(conn, proposal_id)
    lines = [
        f"PROPOSTA #{proposal_id}",
        f"Representante comercial: {proposal['seller_name']} <{proposal['seller_email']}>",
        f"Empresa: {proposal['company_name']}",
        f"Cliente: {proposal['customer_name']} - {proposal['cnpj']}",
        f"Tipo: {proposal['order_type']}",
        f"OC cliente: {proposal['purchase_order'] or ''}",
        f"Comissao: {proposal['commission_percent']}%",
        f"Nota fiscal: {proposal['invoice_type']}",
        f"Nota Fiscal via Operador Fiscal: {tax_operator_invoice_label(proposal.get('tax_operator_invoice'))}",
        f"Frete: {proposal['freight_type']}",
        f"Entrega: {proposal['delivery_type']}",
        f"Data programada: {proposal['scheduled_delivery_date'] or ''}",
        f"Desconto: {proposal['discount_percent']}% em {normalize_discount_on(proposal.get('discount_on'))}",
        f"Condicao de pagamento: {proposal['payment_terms']}",
        f"Observacoes: {proposal['notes'] or ''}",
        "",
        "ITENS",
    ]
    total = 0.0
    for item in items:
        subtotal = item["quantity"] * item["negotiated_price"]
        total += subtotal
        lines.append(f"- {item['code']} | {item['name']} | qtd {item['quantity']} | preco {item['negotiated_price']:.2f} | subtotal {subtotal:.2f}")
    lines.append(f"TOTAL: {total:.2f}")
    return "\n".join(lines)
