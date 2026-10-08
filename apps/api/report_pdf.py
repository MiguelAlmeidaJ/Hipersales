from __future__ import annotations

"""Renderização dos relatórios em PDF."""

try:
    from .shared import *
except ImportError:  # Execução direta: python backend/app.py
    from shared import *


class ReportPdfMixin:
    def admin_followup_report_pdf(self, report: dict[str, Any]) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from xml.sax.saxutils import escape

        def txt(value: Any) -> str:
            return str(value if value is not None else "")

        def clip(value: Any, limit: int) -> str:
            text_value = txt(value)
            return text_value[:limit]

        buffer = io.BytesIO()
        page_size = landscape(A4)
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=8 * mm,
            leftMargin=8 * mm,
            topMargin=9 * mm,
            bottomMargin=9 * mm,
            title=report["title"],
            author="HiperSales Web",
        )
        page_width = page_size[0] - doc.leftMargin - doc.rightMargin
        ink = colors.black
        line = colors.black
        light_line = colors.HexColor("#c9c9c9")
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="FollowTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=9.5, textColor=ink))
        styles.add(ParagraphStyle(name="FollowMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=5.8, leading=6.8, textColor=ink))

        filters = report.get("filters") or {}
        story: list[Any] = [
            Paragraph(escape(report["title"]), styles["FollowTitle"]),
            Paragraph(f"Dt Inicio: {escape(txt(filters.get('date_from') or 'TODAS'))}", styles["FollowMeta"]),
            Paragraph(f"Dt.Fim: {escape(txt(filters.get('date_to') or 'TODAS'))}", styles["FollowMeta"]),
            Paragraph(f"Status: {escape(txt(filters.get('status') or 'TODOS'))}", styles["FollowMeta"]),
            Paragraph(f"Representante: {escape(txt(filters.get('seller') or 'TODOS'))}", styles["FollowMeta"]),
            Paragraph(f"Empresa: {escape(txt(filters.get('company') or 'TODAS'))}", styles["FollowMeta"]),
            Paragraph(f"Cliente: {escape(txt(filters.get('customer') or 'TODOS'))}", styles["FollowMeta"]),
            Spacer(1, 5 * mm),
        ]

        columns = report.get("columns") or []
        char_limits = [10, 13, 12, 12, 12, 22, 18, 42, 15, 18]
        data: list[list[Any]] = [columns]
        for row in report.get("rows") or []:
            data.append([clip(cell, char_limits[index] if index < len(char_limits) else 20) for index, cell in enumerate(row)])
        if len(data) == 1:
            data.append(["Nenhum pedido encontrado."] + [""] * (len(columns) - 1))

        col_widths = [17 * mm, 24 * mm, 22 * mm, 23 * mm, 23 * mm, 34 * mm, 31 * mm, 58 * mm, 27 * mm, 21 * mm]
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, 0), 5.5),
            ("FONTSIZE", (0, 1), (-1, -1), 5.0),
            ("LEADING", (0, 0), (-1, -1), 5.8),
            ("TEXTCOLOR", (0, 0), (-1, -1), ink),
            ("LINEBELOW", (0, 0), (-1, 0), 0.45, line),
            ("LINEBELOW", (0, 1), (-1, -1), 0.18, light_line),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1.2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.2),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
        ]))
        story.append(table)
        story.append(Spacer(1, 5 * mm))

        total_value = "-"
        total_count = len(report.get("rows") or [])
        for label, value in report.get("summary") or []:
            if str(label).lower().startswith("valor"):
                total_value = value
            if str(label).lower().startswith("qtde"):
                total_count = value
        footer_table = Table(
            [[f"Qtde Pedidos: {total_count}", f"Valor Total dos Pedidos: {total_value}"]],
            colWidths=[page_width * 0.5, page_width * 0.5],
        )
        footer_table.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.65, line),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.2),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(footer_table)

        def draw_border(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(line)
            canvas.setLineWidth(0.8)
            canvas.rect(4 * mm, 4 * mm, page_size[0] - 8 * mm, page_size[1] - 8 * mm)
            canvas.restoreState()

        doc.build(story, onFirstPage=draw_border, onLaterPages=draw_border)
        return buffer.getvalue()

    def admin_report_pdf(self, conn: sqlite3.Connection, report_type: str, query: dict[str, list[str]]) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from xml.sax.saxutils import escape

        report = self.admin_report_data(conn, report_type, query)
        report["filters"] = report.get("filters") or self.admin_report_filter_labels(conn, query)
        report_key = slugify(report_type or "vendas").replace("-", "_")
        if report_key in {"acompanhamento", "acompanhamento_de_pedidos", "pedidos"}:
            return self.admin_followup_report_pdf(report)
        buffer = io.BytesIO()
        page_size = landscape(A4)
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=8 * mm,
            leftMargin=8 * mm,
            topMargin=9 * mm,
            bottomMargin=9 * mm,
            title=report["title"],
            author="HiperSales Web",
        )
        page_width = page_size[0] - doc.leftMargin - doc.rightMargin
        ink = colors.black
        line = colors.black
        light_line = colors.HexColor("#c9c9c9")
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=9.5, textColor=ink))
        styles.add(ParagraphStyle(name="ReportMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=5.8, leading=6.8, textColor=ink))
        styles.add(ParagraphStyle(name="ReportBody", parent=styles["Normal"], fontName="Helvetica", fontSize=5.3, leading=6.2, textColor=ink))
        styles.add(ParagraphStyle(name="ReportBold", parent=styles["ReportBody"], fontName="Helvetica-Bold"))
        styles.add(ParagraphStyle(name="ReportRight", parent=styles["ReportBody"], alignment=TA_RIGHT))
        styles.add(ParagraphStyle(name="ReportCenter", parent=styles["ReportBody"], alignment=TA_CENTER))

        def text(value: Any) -> str:
            return escape(str(value if value is not None else ""))

        def para(value: Any, style: str = "ReportBody") -> Paragraph:
            return Paragraph(text(value), styles[style])

        def clip(value: Any, limit: int) -> str:
            text_value = str(value if value is not None else "")
            return text_value[:limit]

        def is_money(value: Any) -> bool:
            return str(value or "").strip().startswith("R$")

        filters = report.get("filters") or {}
        story: list[Any] = []
        story.extend([
            Paragraph(text(report["title"]), styles["ReportTitle"]),
            Paragraph(f"Dt Inicio: {text(filters.get('date_from') or 'TODAS')}", styles["ReportMeta"]),
            Paragraph(f"Dt.Fim: {text(filters.get('date_to') or 'TODAS')}", styles["ReportMeta"]),
            Paragraph(f"Status: {text(filters.get('status') or 'TODOS')}", styles["ReportMeta"]),
            Paragraph(f"Representante: {text(filters.get('seller') or 'TODOS')}", styles["ReportMeta"]),
            Paragraph(f"Empresa: {text(filters.get('company') or 'TODAS')}", styles["ReportMeta"]),
            Paragraph(f"Cliente: {text(filters.get('customer') or 'TODOS')}", styles["ReportMeta"]),
            Spacer(1, 5 * mm),
        ])

        columns = report.get("columns") or []
        data: list[list[Any]] = [[para(column, "ReportBold") for column in columns]]
        char_limits_by_key = {
            "vendas": [10, 12, 24, 22, 42, 20, 16],
            "relatorio_de_vendas": [10, 12, 24, 22, 42, 20, 16],
            "bonificacoes": [10, 12, 24, 22, 40, 18, 8, 16],
            "relatorio_de_bonificacoes": [10, 12, 24, 22, 40, 18, 8, 16],
            "bonificacao": [10, 12, 24, 22, 40, 18, 8, 16],
            "produtos": [14, 56, 28, 20, 8, 14, 16, 16],
            "produtos_vendidos": [14, 56, 28, 20, 8, 14, 16, 16],
            "relatorio_de_produtos_vendidos": [14, 56, 28, 20, 8, 14, 16, 16],
            "prazo": [58, 18, 10, 18],
            "prazo_pagamento": [58, 18, 10, 18],
            "relatorio_de_prazo_pagamento": [58, 18, 10, 18],
            "fechamento": [38, 10, 16, 16, 10, 10, 10, 14],
            "fechamento_representante": [38, 10, 16, 16, 10, 10, 10, 14],
            "fechamento_mensal": [38, 10, 16, 16, 10, 10, 10, 14],
        }
        char_limits = char_limits_by_key.get(report_key, [24] * len(columns))
        for row in report.get("rows") or []:
            data.append([
                para(
                    clip(cell, char_limits[index] if index < len(char_limits) else 24),
                    "ReportRight" if is_money(cell) else "ReportBody",
                )
                for index, cell in enumerate(row)
            ])
        if len(data) == 1:
            data.append([para("Nenhum registro encontrado.")] + [para("") for _ in columns[1:]])
        widths_by_key = {
            "vendas": [18, 22, 39, 34, 73, 31, 28],
            "relatorio_de_vendas": [18, 22, 39, 34, 73, 31, 28],
            "bonificacoes": [18, 22, 37, 33, 65, 28, 15, 26],
            "relatorio_de_bonificacoes": [18, 22, 37, 33, 65, 28, 15, 26],
            "bonificacao": [18, 22, 37, 33, 65, 28, 15, 26],
            "produtos": [20, 82, 38, 28, 16, 24, 29, 29],
            "produtos_vendidos": [20, 82, 38, 28, 16, 24, 29, 29],
            "relatorio_de_produtos_vendidos": [20, 82, 38, 28, 16, 24, 29, 29],
            "prazo": [120, 45, 36, 56],
            "prazo_pagamento": [120, 45, 36, 56],
            "relatorio_de_prazo_pagamento": [120, 45, 36, 56],
            "fechamento": [62, 22, 34, 34, 22, 22, 22, 38],
            "fechamento_representante": [62, 22, 34, 34, 22, 22, 22, 38],
            "fechamento_mensal": [62, 22, 34, 34, 22, 22, 22, 38],
        }
        raw_widths = widths_by_key.get(report_key)
        if raw_widths and len(raw_widths) == len(columns):
            col_widths = [width * mm for width in raw_widths]
        else:
            col_widths = [page_width / max(1, len(columns)) for _ in columns]
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, 0), 5.5),
            ("FONTSIZE", (0, 1), (-1, -1), 5.0),
            ("LEADING", (0, 0), (-1, -1), 5.8),
            ("TEXTCOLOR", (0, 0), (-1, -1), ink),
            ("LINEBELOW", (0, 0), (-1, 0), 0.45, line),
            ("LINEBELOW", (0, 1), (-1, -1), 0.18, light_line),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1.2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.2),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
        ]))
        story.append(table)
        story.append(Spacer(1, 5 * mm))

        summary = report.get("summary") or []
        summary_cells: list[Any] = []
        summary_widths: list[float] = []
        for label, value in summary:
            summary_cells.append(Paragraph(f"<b>{text(label)}:</b> {text(value)}", styles["ReportMeta"]))
            summary_widths.append(page_width / max(1, len(summary)))
        if summary_cells:
            summary_table = Table([summary_cells], colWidths=summary_widths)
            summary_table.setStyle(TableStyle([
                ("LINEABOVE", (0, 0), (-1, 0), 0.65, line),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                ("ALIGN", (-1, 0), (-1, 0), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(summary_table)

        def draw_border(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(line)
            canvas.setLineWidth(0.8)
            canvas.rect(4 * mm, 4 * mm, page_size[0] - 8 * mm, page_size[1] - 8 * mm)
            canvas.setFont("Helvetica", 5.5)
            canvas.drawRightString(page_size[0] - 8 * mm, 5.5 * mm, f"Pagina {document.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=draw_border, onLaterPages=draw_border)
        return buffer.getvalue()

    def weekly_manager_report_pdf(self, report: dict[str, Any]) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from xml.sax.saxutils import escape

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title="Relatorio semanal gerencial",
            author="HiperSales Web",
        )

        navy = colors.black
        teal = colors.black
        muted = colors.black
        line = colors.black
        soft = colors.white

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="MgrTitle", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=20, textColor=navy, alignment=TA_LEFT))
        styles.add(ParagraphStyle(name="MgrSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=navy))
        styles.add(ParagraphStyle(name="MgrBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=colors.HexColor("#102035")))
        styles.add(ParagraphStyle(name="MgrBodyBold", parent=styles["MgrBody"], fontName="Helvetica-Bold"))
        styles.add(ParagraphStyle(name="MgrSmall", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, textColor=muted))
        styles.add(ParagraphStyle(name="MgrRight", parent=styles["MgrBody"], alignment=TA_RIGHT))

        def text(value: Any) -> str:
            return escape(str(value or ""))

        def para(value: Any, style: str = "MgrBody") -> Paragraph:
            return Paragraph(text(value), styles[style])

        def money(value: Any) -> str:
            try:
                return format_brl(float(value or 0))
            except (TypeError, ValueError):
                return format_brl(0)

        story: list[Any] = []
        period_start = format_date_for_pdf(report.get("period_start"))
        period_end = format_date_for_pdf(report.get("period_end"))
        header = Table(
            [[
                Paragraph("RELATORIO SEMANAL GERENCIAL", styles["MgrTitle"]),
                Paragraph(f"Periodo: {text(period_start)} a {text(period_end)}", styles["MgrRight"]),
            ]],
            colWidths=[102 * mm, 69 * mm],
        )
        header.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(header)
        story.append(Spacer(1, 3 * mm))

        seller_rows = [[para("Representante", "MgrBodyBold"), para("Pedidos", "MgrBodyBold"), para("Valor", "MgrBodyBold")]]
        for row in report.get("sellers", []):
            seller_rows.append([
                para(row.get("name") or ""),
                para(row.get("order_count", 0), "MgrRight"),
                para(money(row.get("total", 0)), "MgrRight"),
            ])
        if len(seller_rows) == 1:
            seller_rows.append([para("Sem representantes ativos."), "", ""])
        seller_table = Table(seller_rows, colWidths=[86 * mm, 28 * mm, 57 * mm], repeatRows=1)
        seller_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(Paragraph("Ranking Time Comercial", styles["MgrSection"]))
        story.append(seller_table)
        story.append(Spacer(1, 3 * mm))

        product_rows = [[para("Produto", "MgrBodyBold"), para("Empresa", "MgrBodyBold"), para("Qtd", "MgrBodyBold"), para("Valor", "MgrBodyBold")]]
        for row in report.get("top_products", []):
            product_rows.append([
                para(row.get("name") or ""),
                para(row.get("company_name") or ""),
                para(f"{float(row.get('quantity') or 0):g}".replace(".", ","), "MgrRight"),
                para(money(row.get("total", 0)), "MgrRight"),
            ])
        if len(product_rows) == 1:
            product_rows.append([para("Sem produtos no periodo."), "", "", ""])
        product_table = Table(product_rows, colWidths=[70 * mm, 44 * mm, 22 * mm, 35 * mm], repeatRows=1)
        product_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), teal),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(Paragraph("Top produtos vendidos", styles["MgrSection"]))
        story.append(product_table)

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

    def customer_performance_pdf(self, report: dict[str, Any]) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Rect, String
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from xml.sax.saxutils import escape

        font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        bold_font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        font_name = "Helvetica"
        bold_font_name = "Helvetica-Bold"
        if font_path.exists() and bold_font_path.exists():
            try:
                if "HiperDejaVu" not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont("HiperDejaVu", str(font_path)))
                    pdfmetrics.registerFont(TTFont("HiperDejaVu-Bold", str(bold_font_path)))
                font_name = "HiperDejaVu"
                bold_font_name = "HiperDejaVu-Bold"
            except Exception:
                font_name = "Helvetica"
                bold_font_name = "Helvetica-Bold"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=16 * mm,
            title=f"Analise de desempenho - {report.get('customer', {}).get('legal_name') or 'cliente'}",
            author="HiperSales Web",
        )

        ink = colors.HexColor("#111827")
        muted = colors.HexColor("#374151")
        grid = colors.HexColor("#d1d5db")
        icon_blue = colors.HexColor("#1769b8")

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="PerfTitle", parent=styles["Heading1"], fontName=bold_font_name, fontSize=15, leading=18, textColor=ink, alignment=TA_LEFT, spaceAfter=8))
        styles.add(ParagraphStyle(name="PerfSection", parent=styles["Heading2"], fontName=bold_font_name, fontSize=11, leading=14, textColor=ink, spaceBefore=3, spaceAfter=4))
        styles.add(ParagraphStyle(name="PerfBody", parent=styles["Normal"], fontName=font_name, fontSize=9, leading=12, textColor=ink))
        styles.add(ParagraphStyle(name="PerfBodyBold", parent=styles["PerfBody"], fontName=bold_font_name))
        styles.add(ParagraphStyle(name="PerfSmall", parent=styles["Normal"], fontName=font_name, fontSize=7.4, leading=9, textColor=muted))
        styles.add(ParagraphStyle(name="PerfRight", parent=styles["PerfBody"], alignment=TA_RIGHT))
        styles.add(ParagraphStyle(name="PerfCenter", parent=styles["PerfBody"], alignment=TA_CENTER))
        styles.add(ParagraphStyle(name="PerfIcon", parent=styles["PerfBody"], fontName=font_name, fontSize=13, leading=14, alignment=TA_CENTER))

        def text(value: Any) -> str:
            return escape(str(value or ""))

        def para(value: Any, style: str = "PerfBody") -> Paragraph:
            return Paragraph(text(value), styles[style])

        def rich(value: Any, style: str = "PerfBody") -> Paragraph:
            return Paragraph(str(value or ""), styles[style])

        def money(value: Any) -> str:
            try:
                return format_brl(float(value or 0))
            except (TypeError, ValueError):
                return format_brl(0)

        month_names = {
            1: "JAN", 2: "FEV", 3: "MAR", 4: "ABR", 5: "MAI", 6: "JUN",
            7: "JUL", 8: "AGO", 9: "SET", 10: "OUT", 11: "NOV", 12: "DEZ",
        }

        def safe_date(value: Any) -> str:
            return format_date_for_pdf(value) or "-"

        def month_year(value: datetime | None) -> str:
            if not value:
                return "-"
            return f"{month_names.get(value.month, value.strftime('%m'))}/{value.year}"

        def pdf_icon(kind: str) -> Drawing:
            drawing = Drawing(16, 16)
            stroke = icon_blue
            if kind == "customer":
                drawing.add(Circle(8, 11, 3, strokeColor=stroke, fillColor=None, strokeWidth=1.4))
                drawing.add(PolyLine([3, 2, 4.5, 5, 8, 6.5, 11.5, 5, 13, 2], strokeColor=stroke, strokeWidth=1.4))
            elif kind == "history":
                drawing.add(Line(3, 3, 3, 13, strokeColor=stroke, strokeWidth=1.2))
                drawing.add(Line(3, 3, 14, 3, strokeColor=stroke, strokeWidth=1.2))
                drawing.add(PolyLine([4, 5, 7, 8, 9, 7, 13, 12], strokeColor=stroke, strokeWidth=1.6))
                drawing.add(PolyLine([11.5, 12, 13, 12, 13, 10.5], strokeColor=stroke, strokeWidth=1.4))
            elif kind == "orders":
                drawing.add(Rect(4, 2, 9, 12, strokeColor=stroke, fillColor=None, strokeWidth=1.3))
                drawing.add(PolyLine([10, 14, 13, 11, 10, 11, 10, 14], strokeColor=stroke, strokeWidth=1))
                drawing.add(PolyLine([5.6, 7.5, 7, 6, 9.6, 9.2], strokeColor=stroke, strokeWidth=1.4))
                drawing.add(Line(6, 4.3, 11, 4.3, strokeColor=stroke, strokeWidth=1))
            elif kind == "products":
                drawing.add(Rect(4, 4, 8, 8, strokeColor=stroke, fillColor=None, strokeWidth=1.3))
                drawing.add(PolyLine([4, 12, 8, 14, 12, 12], strokeColor=stroke, strokeWidth=1.1))
                drawing.add(Line(8, 14, 8, 6, strokeColor=stroke, strokeWidth=1.1))
                drawing.add(Line(4, 8, 12, 8, strokeColor=stroke, strokeWidth=1.1))
            elif kind == "lead":
                drawing.add(Rect(2.5, 6, 8, 5, strokeColor=stroke, fillColor=None, strokeWidth=1.3))
                drawing.add(PolyLine([10.5, 6, 13.5, 6, 12.2, 9, 10.5, 9], strokeColor=stroke, strokeWidth=1.3))
                drawing.add(Circle(5, 5, 1.2, strokeColor=stroke, fillColor=None, strokeWidth=1.2))
                drawing.add(Circle(12, 5, 1.2, strokeColor=stroke, fillColor=None, strokeWidth=1.2))
                drawing.add(Line(3.5, 12.5, 8, 12.5, strokeColor=stroke, strokeWidth=1))
            else:
                drawing.add(String(5, 3, "•", fontSize=12, fillColor=stroke))
            return drawing

        def section(icon: str, title: str) -> Table:
            item = Table(
                [[pdf_icon(icon), Paragraph(title, styles["PerfSection"])]],
                colWidths=[8 * mm, 160 * mm],
            )
            item.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            return item

        def plain_table(rows: list[list[Any]], widths: list[float], align_right_cols: tuple[int, ...] = ()) -> Table:
            table = Table(rows, colWidths=widths, repeatRows=1)
            style = [
                ("LINEBELOW", (0, 0), (-1, 0), 0.65, colors.black),
                ("LINEBELOW", (0, 1), (-1, -1), 0.25, grid),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
            for col in align_right_cols:
                style.append(("ALIGN", (col, 1), (col, -1), "RIGHT"))
            table.setStyle(TableStyle(style))
            return table

        customer = report.get("customer", {})
        customer_title = str(customer.get("legal_name") or "cliente").strip()
        summary = report.get("summary", {})
        orders = report.get("orders", [])
        products = report.get("products", [])
        lead_time_rows = report.get("lead_time_rows", [])

        story: list[Any] = []
        story.append(Paragraph(f"ANÁLISE DE DESEMPENHO - {text(customer_title)}", styles["PerfTitle"]))
        story.append(Spacer(1, 2 * mm))

        story.append(section("customer", "Cliente"))
        story.append(rich(f"<b>Razão Social:</b> {text(customer.get('legal_name') or '-')}"))
        story.append(rich(f"<b>CNPJ:</b> {text(customer.get('cnpj') or '-')}"))
        story.append(rich(f"<b>Endereço:</b> {text(customer.get('address') or '-')}"))
        story.append(Spacer(1, 4 * mm))

        story.append(section("history", "Histórico"))
        story.append(rich(f"O fornecimento iniciou em <b>{text(safe_date(summary.get('first_order_at')))}</b>."))
        story.append(rich(f"Até o presente momento foram realizados <b>{text(summary.get('total_orders', 0))}</b> pedidos para o cliente."))
        story.append(rich(f"A soma de todos os pedidos transmitidos até o momento é de <b>{text(money(summary.get('total_value', 0)))}</b>."))
        story.append(rich(f"Esse valor representa um ticket médio mensal de <b>{text(money(summary.get('avg_monthly', 0)))}</b>."))
        story.append(rich(f"O ticket médio por pedido representa <b>{text(money(summary.get('avg_order_value', 0)))}</b>."))
        story.append(rich(f"O cliente tem um prazo médio de pagamento de <b>{text(format_decimal_pt(summary.get('avg_payment_days', 0)))}</b> dias."))
        story.append(Spacer(1, 4 * mm))

        story.append(section("orders", "Pedidos"))
        order_rows = [[
            para("Nº Pedido", "PerfBodyBold"),
            para("Data Emissão", "PerfBodyBold"),
            para("Mês/Ano", "PerfBodyBold"),
            para("Valor", "PerfBodyBold"),
            para("Cond Pagamento", "PerfBodyBold"),
            para("%Variação", "PerfBodyBold"),
        ]]
        for row in orders:
            created_at = row.get("created_at_dt")
            order_rows.append([
                para(f"#{row.get('order_number') or row.get('id')}"),
                para(safe_date(row.get("created_at")), "PerfCenter"),
                para(month_year(created_at), "PerfCenter"),
                para(money(row.get("total", 0)), "PerfRight"),
                para(row.get("payment_terms") or "-"),
                para(row.get("variation_label") or "-", "PerfCenter"),
            ])
        if len(order_rows) == 1:
            order_rows.append([para("Nenhum pedido localizado."), "", "", "", "", ""])
        story.append(plain_table(order_rows, [19 * mm, 24 * mm, 22 * mm, 27 * mm, 49 * mm, 24 * mm], (3,)))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            f"Baseado nas informações acima, o cliente possui um índice de recompra de {summary.get('reorder_days', 0)} em {summary.get('reorder_days', 0)} dias.",
            styles["PerfBody"],
        ))
        story.append(Spacer(1, 4 * mm))

        story.append(section("products", "Ranking de Produtos"))
        product_rows = [[
            para("Cód", "PerfBodyBold"),
            para("Produto", "PerfBodyBold"),
            para("Unidade", "PerfBodyBold"),
            para("Qtd Adquirida", "PerfBodyBold"),
            para("Soma Total", "PerfBodyBold"),
            para("Ranking", "PerfBodyBold"),
        ]]
        for index, row in enumerate(products[:10], start=1):
            product_rows.append([
                para(row.get("code") or "-"),
                para(row.get("name") or "-"),
                para(row.get("unit") or "-", "PerfCenter"),
                para(f"{float(row.get('quantity') or 0):g}".replace(".", ","), "PerfCenter"),
                para(money(row.get("total", 0)), "PerfRight"),
                para(f"{index}º", "PerfCenter"),
            ])
        if len(product_rows) == 1:
            product_rows.append([para("Nenhum produto encontrado."), "", "", "", "", ""])
        story.append(plain_table(product_rows, [17 * mm, 62 * mm, 28 * mm, 26 * mm, 27 * mm, 14 * mm], (4,)))

        story.append(PageBreak())
        story.append(section("lead", "Lead Time"))
        lead_rows = [[
            para("Nº Pedido", "PerfBodyBold"),
            para("Data Emissão", "PerfBodyBold"),
            para("Mês/Ano", "PerfBodyBold"),
            para("Valor", "PerfBodyBold"),
            para("Data Faturamento", "PerfBodyBold"),
            para("Lead Time", "PerfBodyBold"),
        ]]
        for row in lead_time_rows:
            created_at = row.get("created_at_dt")
            lead_value = row.get("lead_time_days")
            lead_rows.append([
                para(f"#{row.get('order_number') or row.get('id')}"),
                para(safe_date(row.get("created_at")), "PerfCenter"),
                para(month_year(created_at), "PerfCenter"),
                para(money(row.get("total", 0)), "PerfRight"),
                para(safe_date(row.get("billed_at")), "PerfCenter"),
                para(f"{lead_value} DIAS" if isinstance(lead_value, int) else "-", "PerfCenter"),
            ])
        if len(lead_rows) == 1:
            lead_rows.append([para("Nenhum pedido faturado encontrado."), "", "", "", "", ""])
        story.append(plain_table(lead_rows, [19 * mm, 24 * mm, 22 * mm, 30 * mm, 34 * mm, 25 * mm], (3,)))
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(
            f"Baseado nas informações acima, o cliente possui um prazo médio de entrega de {summary.get('avg_lead_time', 0)} dias.",
            styles["PerfBody"],
        ))

        def footer(canvas, document):
            canvas.saveState()
            canvas.setFont(font_name, 7)
            canvas.setFillColor(muted)
            canvas.drawRightString(A4[0] - document.rightMargin, 6 * mm, f"Pagina {document.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return buffer.getvalue()

    def weekly_seller_report_pdf(self, report: dict[str, Any]) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from xml.sax.saxutils import escape

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title="Relatorio semanal de atividades",
            author="HiperSales Web",
        )

        navy = colors.black
        blue = colors.black
        teal = colors.black
        ink = colors.black
        muted = colors.black
        line = colors.black
        soft = colors.white
        success_soft = colors.white

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="WeeklyTitle", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=20, textColor=navy, alignment=TA_LEFT))
        styles.add(ParagraphStyle(name="WeeklySubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=muted))
        styles.add(ParagraphStyle(name="WeeklySection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=navy))
        styles.add(ParagraphStyle(name="WeeklyBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=ink))
        styles.add(ParagraphStyle(name="WeeklyBodyBold", parent=styles["WeeklyBody"], fontName="Helvetica-Bold"))
        styles.add(ParagraphStyle(name="WeeklySmall", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, textColor=muted))
        styles.add(ParagraphStyle(name="WeeklyRight", parent=styles["WeeklyBody"], alignment=TA_RIGHT))

        def text(value: Any) -> str:
            return escape(str(value or ""))

        def para(value: Any, style: str = "WeeklyBody") -> Paragraph:
            return Paragraph(text(value), styles[style])

        def money(value: Any) -> str:
            try:
                return format_brl(float(value or 0))
            except (TypeError, ValueError):
                return format_brl(0)

        story: list[Any] = []
        seller = report.get("seller")
        period_start = format_date_for_pdf(report.get("period_start"))
        period_end = format_date_for_pdf(report.get("period_end"))

        logo_path = FRONTEND_DIR / "assets" / "logoweb.png"
        if not logo_path.exists():
            logo_path = FRONTEND_DIR / "assets" / "logoapp.png"
        header = Table(
            [[
                Paragraph("RELATORIO SEMANAL DE ATIVIDADES", styles["WeeklyTitle"]),
                Paragraph(
                    f"Representante: {text(seller.get('name') if seller else 'Consolidado')}<br/>"
                    f"Periodo: {text(period_start)} a {text(period_end)}",
                    styles["WeeklyRight"],
                ),
            ]],
            colWidths=[102 * mm, 69 * mm],
        )
        header.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]))
        story.append(header)
        story.append(Spacer(1, 3 * mm))

        summary = report.get("summary", {})
        summary_table = Table(
            [[
                para("Pedidos no periodo", "WeeklySmall"),
                para("Valor total", "WeeklySmall"),
                para("Clientes na carteira", "WeeklySmall"),
                para("Clientes com atencao", "WeeklySmall"),
            ],
            [
                para(summary.get("orders_count", 0), "WeeklyBodyBold"),
                para(money(summary.get("total_value", 0)), "WeeklyBodyBold"),
                para(summary.get("customers_count", 0), "WeeklyBodyBold"),
                para(summary.get("urgent_count", 0), "WeeklyBodyBold"),
            ]],
            colWidths=[42 * mm, 42 * mm, 42 * mm, 42 * mm],
        )
        summary_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 1), (-1, 1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Movimentacao por status", styles["WeeklySection"]))
        status_rows = [[para("Status", "WeeklyBodyBold"), para("Qtde", "WeeklyBodyBold"), para("Valor", "WeeklyBodyBold")]]
        for row in report.get("statuses", []):
            status_rows.append([para(row.get("label"), "WeeklyBody"), para(row.get("count", 0), "WeeklyRight"), para(money(row.get("total", 0)), "WeeklyRight")])
        if len(status_rows) == 1:
            status_rows.append([para("Sem dados", "WeeklyBody"), para("-", "WeeklyRight"), para("-", "WeeklyRight")])
        status_table = Table(status_rows, colWidths=[90 * mm, 40 * mm, 41 * mm], repeatRows=1)
        status_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Evolucao mensal", styles["WeeklySection"]))
        month_rows = [[para("Mes", "WeeklyBodyBold"), para("Pedidos", "WeeklyBodyBold"), para("Valor", "WeeklyBodyBold")]]
        for row in report.get("months", []):
            month_rows.append([para(row.get("label"), "WeeklyBody"), para(row.get("count", 0), "WeeklyRight"), para(money(row.get("total", 0)), "WeeklyRight")])
        if len(month_rows) == 1:
            month_rows.append([para("Sem dados", "WeeklyBody"), para("-", "WeeklyRight"), para("-", "WeeklyRight")])
        month_table = Table(month_rows, colWidths=[52 * mm, 24 * mm, 95 * mm], repeatRows=1)
        month_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(month_table)
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Clientes com atencao", styles["WeeklySection"]))
        urgent_rows = [[para("Cliente", "WeeklyBodyBold"), para("CNPJ", "WeeklyBodyBold"), para("Ultimo pedido", "WeeklyBodyBold"), para("Total", "WeeklyBodyBold")]]
        for row in report.get("urgent_customers", [])[:10]:
            urgent_rows.append([
                para(row.get("trade_name") or row.get("legal_name") or ""),
                para(row.get("cnpj") or ""),
                para(format_datetime_for_pdf(row.get("last_order_at")) or "Sem pedido", "WeeklyBody"),
                para(money(row.get("total", 0)), "WeeklyRight"),
            ])
        if len(urgent_rows) == 1:
            urgent_rows.append([para("Nenhum cliente em alerta.", "WeeklyBody"), "", "", ""])
        urgent_table = Table(urgent_rows, colWidths=[78 * mm, 34 * mm, 31 * mm, 28 * mm], repeatRows=1)
        urgent_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(urgent_table)
        story.append(Spacer(1, 3 * mm))

        recent_rows = [[para("Pedido", "WeeklyBodyBold"), para("Cliente", "WeeklyBodyBold"), para("Data", "WeeklyBodyBold"), para("Valor", "WeeklyBodyBold")]]
        for row in report.get("orders", [])[:10]:
            recent_rows.append([
                para(f"#{row.get('order_number') or row.get('id')}"),
                para(row.get("customer_trade_name") or row.get("customer_name") or ""),
                para(format_datetime_for_pdf(row.get("created_at")) or "", "WeeklyBody"),
                para(money(row.get("total", 0)), "WeeklyRight"),
            ])
        if len(recent_rows) == 1:
            recent_rows.append([para("Sem pedidos no periodo.", "WeeklyBody"), "", "", ""])
        recent_table = Table(recent_rows, colWidths=[28 * mm, 76 * mm, 28 * mm, 40 * mm], repeatRows=1)
        recent_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(recent_table)

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
