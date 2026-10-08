from __future__ import annotations

from pathlib import Path
from textwrap import wrap


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "RELATORIO_COMPLETO_ANALISE_SISTEMA_HIPERSALES_MIGUEL_ALAMEIDA.pdf"

PAGE_W = 595.28
PAGE_H = 841.89
MARGIN_X = 48
CONTENT_W = PAGE_W - (MARGIN_X * 2)

NAVY = (0.035, 0.095, 0.20)
BLUE = (0.05, 0.31, 0.72)
TEAL = (0.06, 0.56, 0.48)
INK = (0.08, 0.13, 0.21)
MUTED = (0.34, 0.40, 0.48)
LIGHT = (0.94, 0.96, 0.98)
WHITE = (1, 1, 1)
RED = (0.72, 0.12, 0.12)
ORANGE = (0.86, 0.43, 0.05)
YELLOW = (0.93, 0.68, 0.10)
GREEN = (0.08, 0.55, 0.34)
LINE = (0.83, 0.87, 0.92)


def pdf_escape(value: str) -> bytes:
    raw = str(value).encode("cp1252", errors="replace")
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


class Report:
    def __init__(self) -> None:
        self.pages: list[list[bytes]] = [[]]
        self.y = PAGE_H - 72
        self.is_cover = True

    @property
    def page(self) -> list[bytes]:
        return self.pages[-1]

    def command(self, value: str | bytes) -> None:
        self.page.append(value.encode("ascii") if isinstance(value, str) else value)

    def color(self, rgb: tuple[float, float, float], stroke: bool = False) -> None:
        op = "RG" if stroke else "rg"
        self.command(f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} {op}\n")

    def rect(self, x: float, y: float, w: float, h: float, fill: tuple[float, float, float], stroke=None) -> None:
        self.color(fill)
        if stroke:
            self.color(stroke, stroke=True)
            self.command(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re B\n")
        else:
            self.command(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re f\n")

    def line(self, x1: float, y1: float, x2: float, y2: float, color=LINE, width: float = 1) -> None:
        self.color(color, stroke=True)
        self.command(f"{width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S\n")

    def text(self, x: float, y: float, value: str, size: float = 10, font: str = "F1", color=INK) -> None:
        self.color(color)
        escaped = pdf_escape(value)
        self.command(f"BT /{font} {size:.2f} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ".encode("ascii") + b"(" + escaped + b") Tj ET\n")

    def start_page(self, title: str = "") -> None:
        self.pages.append([])
        self.is_cover = False
        self.rect(0, PAGE_H - 42, PAGE_W, 42, NAVY)
        self.text(MARGIN_X, PAGE_H - 27, "HIPERSALES  |  ANÁLISE TÉCNICA E DE SEGURANÇA", 8.5, "F2", WHITE)
        if title:
            self.text(PAGE_W - MARGIN_X, PAGE_H - 27, title.upper()[:45], 7.5, "F1", WHITE)
        self.y = PAGE_H - 72

    def ensure(self, needed: float, title: str = "Continuação") -> None:
        if self.y - needed < 58:
            self.start_page(title)

    def heading(self, value: str, level: int = 1) -> None:
        if level == 1:
            self.ensure(58, value)
            self.y -= 4
            self.text(MARGIN_X, self.y, value, 18, "F2", NAVY)
            self.y -= 12
            self.line(MARGIN_X, self.y, PAGE_W - MARGIN_X, self.y, TEAL, 2)
            self.y -= 24
        else:
            self.ensure(40, value)
            self.text(MARGIN_X, self.y, value, 12.5, "F2", BLUE)
            self.y -= 20

    def paragraph(self, value: str, size: float = 9.5, color=INK, indent: float = 0, gap: float = 10, font: str = "F1") -> None:
        width = CONTENT_W - indent
        max_chars = max(25, int(width / (size * 0.50)))
        lines: list[str] = []
        for raw_line in str(value).splitlines() or [""]:
            if not raw_line:
                lines.append("")
            else:
                lines.extend(wrap(raw_line, max_chars, break_long_words=False, break_on_hyphens=False) or [""])
        line_h = size * 1.42
        for line_value in lines:
            self.ensure(line_h + gap, "Continuação")
            if line_value:
                self.text(MARGIN_X + indent, self.y, line_value, size, font, color)
            self.y -= line_h
        self.y -= gap

    def bullet(self, value: str, color=INK, marker: str = "•") -> None:
        size = 9.3
        max_chars = int((CONTENT_W - 18) / (size * 0.50))
        lines = wrap(str(value), max_chars, break_long_words=False, break_on_hyphens=False) or [""]
        self.ensure(len(lines) * 14 + 5, "Continuação")
        self.text(MARGIN_X + 2, self.y, marker, size, "F2", TEAL)
        for index, line_value in enumerate(lines):
            self.text(MARGIN_X + 18, self.y, line_value, size, "F1", color)
            self.y -= 13.2
        self.y -= 3

    def label_value(self, label: str, value: str) -> None:
        self.ensure(24)
        self.text(MARGIN_X, self.y, label.upper(), 7.5, "F2", MUTED)
        self.text(MARGIN_X + 145, self.y, value, 9.5, "F1", INK)
        self.y -= 20

    def callout(self, title: str, body: str, tone=BLUE) -> None:
        max_chars = 90
        lines = wrap(body, max_chars, break_long_words=False, break_on_hyphens=False)
        height = 44 + len(lines) * 12
        self.ensure(height + 14, title)
        self.rect(MARGIN_X, self.y - height + 10, CONTENT_W, height, LIGHT, LINE)
        self.rect(MARGIN_X, self.y - height + 10, 5, height, tone)
        self.text(MARGIN_X + 16, self.y - 10, title, 11, "F2", tone)
        cursor = self.y - 29
        for line_value in lines:
            self.text(MARGIN_X + 16, cursor, line_value, 8.9, "F1", INK)
            cursor -= 12
        self.y -= height + 6

    def finding(self, fid: str, severity: str, title: str, evidence: str, impact: str, recommendation: str) -> None:
        tone = {"CRÍTICA": RED, "ALTA": ORANGE, "MÉDIA": YELLOW, "BAIXA": GREEN}.get(severity, BLUE)
        self.ensure(140, title)
        self.rect(MARGIN_X, self.y - 28, CONTENT_W, 34, tone)
        self.text(MARGIN_X + 12, self.y - 16, f"{fid}  |  {severity}", 9, "F2", WHITE)
        self.y -= 45
        self.text(MARGIN_X, self.y, title, 12.2, "F2", NAVY)
        self.y -= 20
        self.paragraph(f"Evidência: {evidence}", 8.5, MUTED, gap=6)
        self.paragraph(f"Impacto: {impact}", 9.2, INK, gap=6)
        self.paragraph(f"Recomendação: {recommendation}", 9.2, INK, gap=14)

    def risk_row(self, severity: str, quantity: str, interpretation: str, tone) -> None:
        self.ensure(34)
        self.rect(MARGIN_X, self.y - 20, 90, 27, tone)
        self.text(MARGIN_X + 10, self.y - 10, severity, 8.5, "F2", WHITE)
        self.text(MARGIN_X + 108, self.y - 10, quantity, 9, "F2", INK)
        self.text(MARGIN_X + 160, self.y - 10, interpretation, 8.5, "F1", INK)
        self.y -= 34

    def cover(self) -> None:
        self.rect(0, 0, PAGE_W, PAGE_H, NAVY)
        self.rect(0, PAGE_H - 18, PAGE_W, 18, TEAL)
        self.rect(46, 490, 7, 190, TEAL)
        self.text(72, 690, "HIPERSALES", 12, "F2", TEAL)
        self.text(72, 646, "RELATÓRIO COMPLETO", 25, "F2", WHITE)
        self.text(72, 613, "DE ANÁLISE DO SISTEMA", 25, "F2", WHITE)
        self.text(72, 571, "Funcionalidade, segurança, arquitetura e plano de melhoria", 11, "F1", (0.78, 0.84, 0.91))
        self.line(72, 542, 510, 542, TEAL, 2)
        self.text(72, 466, "AUTORIA", 8, "F2", TEAL)
        self.text(72, 440, "Miguel Alameida", 17, "F2", WHITE)
        self.text(72, 418, "Desenvolvedor Nível 3", 11, "F1", (0.78, 0.84, 0.91))
        self.text(72, 330, "DATA DA ANÁLISE", 8, "F2", TEAL)
        self.text(72, 305, "6 de outubro de 2026", 11, "F1", WHITE)
        self.text(72, 232, "CLASSIFICAÇÃO", 8, "F2", TEAL)
        self.text(72, 207, "Uso interno e confidencial", 11, "F1", WHITE)
        self.rect(0, 0, PAGE_W, 44, (0.02, 0.06, 0.13))
        self.text(72, 18, "HiperSales Web  •  Revisão estática e validações não destrutivas", 8, "F1", (0.65, 0.73, 0.82))

    def finish(self) -> None:
        total = len(self.pages)
        for index, commands in enumerate(self.pages, start=1):
            if index == 1:
                continue
            commands.append(f"{LINE[0]:.3f} {LINE[1]:.3f} {LINE[2]:.3f} RG 0.7 w {MARGIN_X:.2f} 42 m {PAGE_W - MARGIN_X:.2f} 42 l S\n".encode("ascii"))
            footer = f"Miguel Alameida  |  Desenvolvedor Nível 3  |  Página {index} de {total}"
            escaped = pdf_escape(footer)
            commands.append(f"{MUTED[0]:.3f} {MUTED[1]:.3f} {MUTED[2]:.3f} rg BT /F1 7.5 Tf 1 0 0 1 {MARGIN_X:.2f} 25 Tm ".encode("ascii") + b"(" + escaped + b") Tj ET\n")

        objects: list[bytes] = []

        def add_object(content: bytes) -> int:
            objects.append(content)
            return len(objects)

        font_regular = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        font_bold = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        font_mono = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")

        page_refs: list[int] = []
        for commands in self.pages:
            stream = b"".join(commands)
            content_ref = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream")
            page_ref = add_object(
                f"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] ".encode()
                + f"/Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R /F3 {font_mono} 0 R >> >> ".encode()
                + f"/Contents {content_ref} 0 R >>".encode()
            )
            page_refs.append(page_ref)

        pages_ref = add_object(
            f"<< /Type /Pages /Kids [{' '.join(f'{ref} 0 R' for ref in page_refs)}] /Count {len(page_refs)} >>".encode()
        )
        for page_ref in page_refs:
            objects[page_ref - 1] = objects[page_ref - 1].replace(b"/Parent 0 0 R", f"/Parent {pages_ref} 0 R".encode())
        catalog_ref = add_object(f"<< /Type /Catalog /Pages {pages_ref} 0 R /PageMode /UseNone >>".encode())
        info_ref = add_object(
            b"<< /Title (" + pdf_escape("Relatório Completo de Análise do Sistema HiperSales")
            + b") /Author (" + pdf_escape("Miguel Alameida - Desenvolvedor Nível 3")
            + b") /Subject (" + pdf_escape("Funcionalidade, segurança, arquitetura e plano de melhoria")
            + b") /Creator (" + pdf_escape("HiperSales Technical Review") + b") >>"
        )

        output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for idx, content in enumerate(objects, start=1):
            offsets.append(len(output))
            output.extend(f"{idx} 0 obj\n".encode())
            output.extend(content)
            output.extend(b"\nendobj\n")
        xref = len(output)
        output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
        for offset in offsets[1:]:
            output.extend(f"{offset:010d} 00000 n \n".encode())
        output.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_ref} 0 R /Info {info_ref} 0 R >>\n"
            f"startxref\n{xref}\n%%EOF".encode()
        )
        OUTPUT.write_bytes(output)


def build_report() -> Path:
    r = Report()
    r.cover()

    r.start_page("Controle do documento")
    r.heading("1. Controle do documento")
    r.label_value("Documento", "Relatório completo de análise do sistema HiperSales")
    r.label_value("Autor", "Miguel Alameida")
    r.label_value("Cargo", "Desenvolvedor Nível 3")
    r.label_value("Data", "6 de outubro de 2026")
    r.label_value("Classificação", "Uso interno e confidencial")
    r.label_value("Escopo", "Código-fonte, banco SQLite, frontend PWA e serviço WhatsApp")
    r.label_value("Método", "Revisão estática e verificações locais não destrutivas")
    r.callout(
        "Nota importante",
        "Nenhum arquivo funcional foi alterado e o servidor não foi iniciado. A inicialização do backend executa migrações, inicia rotinas automáticas e redefine a credencial fixa do superadministrador.",
        ORANGE,
    )
    r.heading("Objetivo", 2)
    r.paragraph(
        "Este relatório documenta o funcionamento do HiperSales, avalia sua arquitetura e segurança, identifica riscos técnicos e operacionais e propõe uma sequência prática de correções para elevar o sistema a um padrão seguro de produção e operação multiempresa."
    )
    r.heading("Limitações", 2)
    r.bullet("Não foi realizado teste de invasão ativo contra ambiente publicado.")
    r.bullet("Não foram usados dados pessoais individuais nem exibidas credenciais ou tokens encontrados.")
    r.bullet("Riscos de dependências refletem o resultado do npm audit em 6 de outubro de 2026.")

    r.start_page("Resumo executivo")
    r.heading("2. Resumo executivo")
    r.callout(
        "Avaliação geral: risco alto",
        "O sistema entrega o fluxo comercial esperado e possui controles básicos corretos, mas não deve ser exposto publicamente como solução multiempresa antes da correção das credenciais fixas, anexos executáveis e falhas de isolamento entre tenants.",
        RED,
    )
    r.paragraph(
        "A aplicação começou como um sistema local de uma empresa e recebeu posteriormente recursos de multi-tenancy. Essa evolução é visível na boa cobertura de tenant_id nas consultas principais, porém os caminhos legados de configurações, relatórios, notificações e WhatsApp ainda assumem o tenant 1 ou usam destinatários globais."
    )
    r.heading("Síntese dos riscos", 2)
    r.risk_row("CRÍTICA", "3", "Comprometimento administrativo ou vazamento entre empresas", RED)
    r.risk_row("ALTA", "3", "Tomada de conta, exposição de segredos ou componente vulnerável", ORANGE)
    r.risk_row("MÉDIA", "5", "Defesas incompletas, indisponibilidade ou injeção de conteúdo", YELLOW)
    r.risk_row("FUNCIONAL", "5", "Resultados incorretos, baixa manutenibilidade ou operação inconsistente", BLUE)
    r.heading("Decisão recomendada", 2)
    r.bullet("Manter o sistema restrito a rede ou acesso controlado até concluir os itens críticos.")
    r.bullet("Executar um hotfix de segurança antes de adicionar novas funcionalidades.")
    r.bullet("Realizar backup consistente do SQLite e iniciar controle de versão antes das alterações.")
    r.bullet("Tratar a correção de multi-tenancy como projeto de dados e autorização, não apenas como filtros adicionais.")

    r.start_page("Arquitetura e funcionamento")
    r.heading("3. Arquitetura e funcionamento")
    r.heading("Fluxo principal", 2)
    r.callout(
        "Navegador",
        "SPA/PWA em HTML, CSS e JavaScript puro. A interface utiliza fetch com cookie de sessão e mantém o estado da aplicação em memória.",
        BLUE,
    )
    r.callout(
        "Backend",
        "Servidor Python baseado em ThreadingHTTPServer. O mesmo processo entrega arquivos estáticos, implementa a API REST, gera PDFs e executa schedulers em threads daemon.",
        TEAL,
    )
    r.callout(
        "Persistência",
        "SQLite em modo WAL, com migrações e seed executados na inicialização. Sessões, configurações, anexos e fila de mensagens ficam no mesmo banco.",
        GREEN,
    )
    r.callout(
        "Integrações",
        "SMTP, APIs públicas de CNPJ, Evolution API e um serviço Node/Baileys separado que consulta endpoints internos do backend.",
        ORANGE,
    )
    r.heading("Pontos de entrada", 2)
    r.bullet("backend/app.py: servidor, banco, autenticação, regras de negócio, PDFs e schedulers.")
    r.bullet("frontend/app.js: interface completa, navegação, formulários e renderização.")
    r.bullet("whatsapp-service/index.mjs: conexão Baileys e consumo da fila interna.")
    r.bullet("scripts/import_carga_leon.py: importação de planilha, usuários e vínculos comerciais.")

    r.start_page("Funcionalidades")
    r.heading("4. Funcionalidades identificadas")
    modules = [
        "Autenticação por cookie e perfis superadministrador, administrador e representante comercial.",
        "Criação de tenants e administração de usuários por empresa.",
        "Cadastro, consulta, edição, inativação e associação de clientes.",
        "Cadastro de empresas representadas, produtos e importação/exportação de catálogo.",
        "Propostas e pedidos com itens, valores negociados, descontos, comissão, frete e pagamento.",
        "Fluxo de status, linha do tempo, PDFs e notificações de pedidos.",
        "Registro de ocorrências com anexos, parecer administrativo e retenção temporária.",
        "Metas comerciais, acompanhamento de carteira, dashboards e relatórios gerenciais.",
        "Consulta automática de CNPJ em dois provedores públicos.",
        "Configuração de SMTP, templates de mensagens e WhatsApp.",
        "PWA com manifest, service worker e cache de recursos estáticos.",
        "Rotinas automáticas para relatórios, lembretes de metas e respostas de WhatsApp.",
    ]
    for item in modules:
        r.bullet(item)
    r.heading("Perfis e autorização", 2)
    r.paragraph(
        "O representante visualiza sua carteira, empresas associadas, pedidos e ocorrências. O administrador opera os dados do tenant, usuários, produtos, clientes, pedidos, metas e configurações. O superadministrador cria e acompanha tenants. A autorização é aplicada no backend, mas possui exceções legadas descritas nos achados."
    )

    r.start_page("Pontos positivos")
    r.heading("5. Controles positivos observados")
    positives = [
        "Consultas SQL majoritariamente parametrizadas, reduzindo significativamente o risco de SQL injection.",
        "Tokens de sessão gerados com secrets.token_urlsafe, fornecendo entropia adequada.",
        "Passwords armazenadas com salt aleatório e comparação em tempo constante.",
        "Cookie de sessão com HttpOnly e SameSite=Lax.",
        "Respostas internas de erro não devolvem stack traces para o navegador.",
        "Escape centralizado de HTML no frontend para a maior parte dos dados apresentados.",
        "Filtros de tenant e associação de vendedor presentes nos fluxos comerciais principais.",
        "Controle de acesso específico para download de anexos de ocorrências.",
        "Limite agregado de 25 MB para anexos após decodificação.",
        "Banco em WAL, chaves estrangeiras habilitadas e busy timeout configurado.",
        "Service worker evita interceptar rotas iniciadas por /api/.",
    ]
    for item in positives:
        r.bullet(item)
    r.callout(
        "Leitura equilibrada",
        "Os achados críticos não significam que todo o sistema esteja inseguro. A base possui decisões corretas; o principal problema é a combinação de credenciais fixas, conteúdo não confiável servido no mesmo domínio e uma migração multiempresa incompleta.",
        TEAL,
    )

    r.start_page("Achados críticos")
    r.heading("6. Achados críticos")
    r.finding(
        "CRIT-01",
        "CRÍTICA",
        "Credencial fixa e redefinição automática do superadministrador",
        "backend/app.py, linhas 597-616; chamada durante migração e seed; README.md, seção de acessos de teste.",
        "A senha administrativa é conhecida por qualquer pessoa com acesso ao código ou documentação. Mesmo que seja alterada pelo usuário, volta ao valor fixo após reiniciar o backend. Com o login sem rate limiting, o risco de tomada completa da plataforma é imediato.",
        "Remover a credencial do código, rotacionar a conta, criar bootstrap único por segredo externo, obrigar troca no primeiro acesso, invalidar sessões existentes e habilitar MFA para superadministradores.",
    )
    r.finding(
        "CRIT-02",
        "CRÍTICA",
        "Stored XSS por anexos HTML ou SVG",
        "backend/app.py, linhas 1824-1832 e 2917-2931.",
        "O MIME declarado pelo cliente é armazenado sem validação e o arquivo é devolvido como inline no mesmo domínio. Um representante pode enviar HTML/SVG com JavaScript; quando um administrador abrir o anexo, o código executará na origem do HiperSales e poderá operar a API com a sessão administrativa.",
        "Validar extensão, assinatura binária e MIME por allowlist; bloquear HTML/SVG; usar attachment para conteúdo não confiável; aplicar CSP sandbox/default-src none e preferir um domínio de arquivos sem cookies.",
    )
    r.finding(
        "CRIT-03",
        "CRÍTICA",
        "Isolamento multiempresa incompleto",
        "backend/app.py, linhas 898-937, 3223-3245, 3453-3494, 6312-6335 e 6465-6471.",
        "O tenant é mantido em dicionário global por id da conexão e assume tenant 1 quando ausente. Configurações podem cair para valores globais, a senha SMTP pode ser exposta a tenants novos, a fila do WhatsApp não filtra tenant e rotinas de relatório usam consultas e destinatários globais.",
        "Eliminar TENANT_CONTEXT, exigir tenant_id explícito e fail-closed, criar configurações por tenant, filtrar todas as filas e schedulers, remover destinatários fixos e criar testes automatizados de isolamento negativo.",
    )

    r.start_page("Achados altos")
    r.heading("7. Achados de severidade alta")
    r.finding(
        "HIGH-01",
        "ALTA",
        "Proteção insuficiente de login e sessão",
        "backend/app.py, linhas 1845-1918 e 4064-4085.",
        "O login aceita tentativas ilimitadas. O cookie não usa Secure, não existe MFA, mudança de senha não invalida sessões anteriores e must_change_password é principalmente uma barreira de interface. O status do tenant também não é verificado ao validar a sessão.",
        "Adicionar rate limiting por IP e conta, MFA para perfis críticos, cookie __Host- com Secure, bloqueio server-side durante troca obrigatória, revogação de sessões e verificação de tenant ativo.",
    )
    r.finding(
        "HIGH-02",
        "ALTA",
        "Gestão inadequada de segredos e artefatos sensíveis",
        ".whatsapp-internal-token não está no .gitignore; SMTP é armazenado no SQLite e retornado pela API; CARGA_LEON.xlsx é consumida com campo de senha em texto claro.",
        "Cópias do diretório, backups ou futuros commits podem expor tokens, credenciais SMTP, dados empresariais e senhas iniciais. A configuração global amplia o impacto para tenants adicionais.",
        "Rotacionar segredos, usar secret manager ou variáveis protegidas, nunca devolver senha SMTP, remover planilhas após migração segura, ampliar .gitignore e adicionar varredura de segredos no CI.",
    )
    r.finding(
        "HIGH-03",
        "ALTA",
        "Dependência transitiva sharp vulnerável",
        "whatsapp-service/package-lock.json: sharp 0.34.5. npm audit reportou advisory GHSA-wq5f-xc86-pv6w.",
        "A versão instalada está abaixo da 0.35.5 corrigida. O advisory classifica a vulnerabilidade como alta e descreve possibilidade de comprometimento de memória/RCE em condições específicas no Linux.",
        "Atualizar Baileys ou aplicar override compatível para sharp >= 0.35.5, reinstalar a partir do lockfile, repetir npm audit e validar conexão, QR, envio e recebimento de mensagens.",
    )

    r.start_page("Achados médios")
    r.heading("8. Achados de severidade média")
    r.finding(
        "MED-01",
        "MÉDIA",
        "Requisições sem limite global de tamanho",
        "backend/app.py, linhas 1789-1796.",
        "Content-Length é lido integralmente antes da validação. O endpoint de login também aceita corpos arbitrariamente grandes. Em conjunto com ThreadingHTTPServer, isso permite consumo excessivo de memória e threads.",
        "Rejeitar corpos acima de limites por rota antes da leitura, configurar timeouts e limites no proxy e usar servidor WSGI/ASGI de produção.",
    )
    r.finding(
        "MED-02",
        "MÉDIA",
        "Custo de hash de senha abaixo da referência atual",
        "backend/app.py, linhas 259-270: PBKDF2-HMAC-SHA256 com 150.000 iterações.",
        "O algoritmo possui salt e comparação correta, porém oferece proteção inferior à recomendação atual em caso de vazamento do banco.",
        "Migrar progressivamente para Argon2id. Se PBKDF2 for obrigatório, elevar o custo para pelo menos 600.000 e rehash no próximo login, após benchmark de capacidade.",
    )
    r.finding(
        "MED-03",
        "MÉDIA",
        "Injeção de HTML em mensagens de e-mail",
        "backend/app.py, linhas 1593-1597: placeholders são substituídos sem escape contextual.",
        "Nomes, observações e outros campos controlados por usuários podem alterar o HTML dos e-mails, inserir links ou elementos de rastreamento e produzir mensagens enganosas.",
        "Escapar todos os valores por contexto HTML e permitir HTML apenas no template administrativo validado/sanitizado.",
    )

    r.start_page("Defesas e operação")
    r.heading("9. Outros riscos técnicos e operacionais")
    r.finding(
        "MED-04",
        "MÉDIA",
        "Cabeçalhos e servidor de produção incompletos",
        "backend/app.py, linhas 1724-1757 e 7672-7681.",
        "O servidor adiciona nosniff, mas não define CSP, frame-ancestors, HSTS, Referrer-Policy ou Permissions-Policy. Ele escuta em 0.0.0.0 e não implementa TLS diretamente.",
        "Colocar o backend atrás de proxy HTTPS endurecido, impedir acesso direto à porta, configurar cabeçalhos de segurança e migrar a camada HTTP para framework/servidor mantido para produção.",
    )
    r.finding(
        "MED-05",
        "MÉDIA",
        "Proteção CSRF baseada principalmente em SameSite",
        "Cookie SameSite=Lax; ausência de token CSRF e validação Origin/Referer; backend não valida Content-Type.",
        "SameSite reduz o risco, mas não cobre cenários same-site em subdomínios, browsers legados, ataques client-side ou futuras mudanças de implantação.",
        "Validar Origin/Referer em operações mutáveis, exigir application/json, adicionar token ou header CSRF e manter SameSite como defesa adicional.",
    )
    r.heading("Referências de segurança", 2)
    r.bullet("OWASP Session Management Cheat Sheet — cookies Secure/HttpOnly/SameSite e ciclo de vida de sessão.")
    r.bullet("OWASP CSRF Prevention Cheat Sheet — token, header customizado e validação de origem.")
    r.bullet("OWASP Password Storage Cheat Sheet — Argon2id e parâmetros de PBKDF2.")

    r.start_page("Funcional e arquitetura")
    r.heading("10. Problemas funcionais e de arquitetura")
    findings = [
        ("FUNC-01", "O relatório chamado semanal usa período inicial de 365 dias em backend/app.py, linhas 4741-4746."),
        ("FUNC-02", "A rotina semanal seleciona representantes sem filtro de tenant e pode falhar ou operar apenas o tenant padrão."),
        ("FUNC-03", "customers.cnpj possui UNIQUE global, impedindo o mesmo CNPJ legítimo em tenants diferentes."),
        ("FUNC-04", "Evolution API e Baileys coexistem como dois caminhos de WhatsApp, aumentando estados divergentes e manutenção."),
        ("FUNC-05", "O banco contém sessões expiradas até que uma rota autenticada execute a limpeza."),
        ("ENG-01", "Backend com 7.685 linhas e frontend com 10.292 linhas concentram responsabilidades demais."),
        ("ENG-02", "Não foram encontrados testes próprios do projeto."),
        ("ENG-03", "Não existe requirements.txt ou pyproject.toml para reproduzir o ambiente Python."),
        ("ENG-04", "As migrações são executadas no startup sem versionamento, dry-run ou rollback formal."),
        ("ENG-05", "Há textos com mojibake, como sequências Ã e Â, indicando inconsistência de codificação."),
    ]
    for code, description in findings:
        r.bullet(f"{code}: {description}")
    r.callout(
        "Consequência",
        "A ausência de modularização e testes torna correções de segurança mais arriscadas, pois uma alteração em autenticação, tenant ou pedidos pode produzir regressões em áreas distantes do mesmo arquivo.",
        ORANGE,
    )

    r.start_page("Banco e dados")
    r.heading("11. Avaliação do banco e dos dados")
    r.heading("Snapshot observado", 2)
    r.paragraph("A inspeção foi realizada em modo somente leitura, sem consultar ou expor registros individuais.")
    snapshot = [
        "Banco principal: database/hypersales.sqlite3, aproximadamente 10,3 MB.",
        "21 tabelas de aplicação.",
        "1 tenant ativo, 22 usuários, 308 clientes e 300 produtos.",
        "208 propostas, 3 ocorrências e 2.090 registros de outbox.",
        "11 sessões presentes, todas expiradas no momento da verificação.",
        "PRAGMA integrity_check: ok.",
        "PRAGMA foreign_key_check: nenhuma violação.",
        "Journal mode: WAL.",
        "backend/hipersales.db existe com tamanho zero e aparenta ser artefato obsoleto.",
    ]
    for item in snapshot:
        r.bullet(item)
    r.heading("Riscos de proteção de dados", 2)
    r.bullet("Dados cadastrais, comunicações e anexos ficam sem criptografia no SQLite.")
    r.bullet("O outbox retém destinatários, assunto, corpo e erros de envio.")
    r.bullet("O form_payload armazena cópia ampla de dados e resposta bruta da consulta de CNPJ.")
    r.bullet("Backup do arquivo principal isolado pode perder alterações ainda presentes no WAL.")
    r.bullet("É necessário definir retenção, acesso, backup, restauração e descarte compatíveis com a LGPD.")

    r.start_page("Validações")
    r.heading("12. Validações realizadas")
    validations = [
        "Parsing AST de backend/app.py e scripts/import_carga_leon.py: aprovado.",
        "node --check em frontend/app.js: aprovado.",
        "node --check em whatsapp-service/index.mjs: aprovado.",
        "PRAGMA integrity_check: aprovado.",
        "PRAGMA foreign_key_check: zero violações.",
        "Verificação de listener local: nenhuma aplicação escutava na porta 8000.",
        "npm ls: árvore principal resolvida com Baileys 7.0.0-rc13, Pino 9.14.0 e qrcode-terminal 0.12.0.",
        "npm audit: uma vulnerabilidade alta e uma moderada.",
        "protobufjs 7.6.2: advisory de DoS; versão corrigida indicada 7.6.5.",
        "sharp 0.34.5: advisory de alta severidade; versão corrigida indicada 0.35.5.",
    ]
    for item in validations:
        r.bullet(item)
    r.heading("O que não foi executado", 2)
    r.bullet("O backend não foi iniciado para evitar mutações, redefinição de senha e disparos automáticos.")
    r.bullet("Não foram enviados e-mails, mensagens de WhatsApp ou requisições de teste aos provedores externos.")
    r.bullet("Não houve exploração do XSS ou tentativa de autenticação com credenciais conhecidas.")

    r.start_page("Plano de correção")
    r.heading("13. Plano de correção priorizado")
    r.heading("Fase 0 — contenção imediata, 0 a 48 horas", 2)
    for item in [
        "Rotacionar superadministrador, token interno, SMTP e credenciais relacionadas.",
        "Remover a redefinição automática e as credenciais do README.",
        "Bloquear upload/visualização inline de HTML e SVG.",
        "Restringir a aplicação a HTTPS e acesso controlado.",
        "Fazer backup consistente do SQLite com WAL e testar a cópia.",
        "Atualizar sharp e protobufjs por versão compatível do Baileys/overrides.",
    ]:
        r.bullet(item)
    r.heading("Fase 1 — hotfix de segurança, até 15 dias", 2)
    for item in [
        "Substituir TENANT_CONTEXT por tenant explícito e fail-closed.",
        "Corrigir filas, relatórios, notificações e configurações por tenant.",
        "Adicionar rate limiting, política server-side de senha e invalidação de sessões.",
        "Adicionar validação Origin/CSRF, limites de corpo e cabeçalhos de segurança.",
        "Mascarar segredos nas respostas e externalizar sua persistência.",
        "Criar testes de autorização e isolamento para todas as rotas mutáveis.",
    ]:
        r.bullet(item)

    r.start_page("Plano 30-90 dias")
    r.heading("14. Evolução em 30 a 90 dias")
    r.heading("De 15 a 45 dias", 2)
    for item in [
        "Migrar hashes para Argon2id e implementar MFA para contas privilegiadas.",
        "Separar autenticação, tenants, clientes, pedidos, ocorrências, relatórios e integrações em módulos.",
        "Adotar framework web mantido, migrações versionadas e servidor de produção.",
        "Escolher uma única integração de WhatsApp e remover o caminho legado.",
        "Criar logs estruturados, auditoria de ações críticas e alertas operacionais.",
        "Corrigir o relatório semanal e parametrizar destinatários por tenant.",
    ]:
        r.bullet(item)
    r.heading("De 45 a 90 dias", 2)
    for item in [
        "Avaliar PostgreSQL para concorrência, constraints compostas e crescimento multiempresa.",
        "Implantar CI com testes, lint, auditoria de dependências e detecção de segredos.",
        "Implementar backups automáticos criptografados e testes periódicos de restauração.",
        "Definir políticas de retenção para anexos, outbox, sessões e payloads de terceiros.",
        "Executar teste de invasão independente após as correções críticas.",
        "Documentar resposta a incidentes e responsabilidades de acesso conforme LGPD.",
    ]:
        r.bullet(item)

    r.start_page("Arquitetura alvo")
    r.heading("15. Arquitetura alvo recomendada")
    r.callout("Entrada", "Proxy HTTPS/WAF com rate limiting, limites de corpo, HSTS e cabeçalhos de segurança.", NAVY)
    r.callout("Aplicação", "Framework Python mantido, rotas modulares, middleware de autenticação/tenant e validação tipada.", BLUE)
    r.callout("Dados", "PostgreSQL ou SQLite com disciplina operacional, migrations versionadas, constraints por tenant e backups testados.", TEAL)
    r.callout("Arquivos", "Object storage ou domínio separado, download autenticado e conteúdo não confiável sempre isolado.", GREEN)
    r.callout("Filas", "Worker dedicado para e-mail, WhatsApp e relatórios, sempre com tenant_id obrigatório e idempotência.", ORANGE)
    r.callout("Segredos", "Secret manager/variáveis protegidas; a interface recebe apenas indicação de que o segredo está configurado.", RED)
    r.heading("Princípio central", 2)
    r.paragraph(
        "Nenhuma função deve descobrir o tenant por fallback ou estado global. O tenant precisa ser derivado da sessão validada, passado explicitamente até o repositório de dados e incluído em todas as chaves, consultas, filas, logs e testes."
    )

    r.start_page("Critérios de aceite")
    r.heading("16. Critérios mínimos para produção")
    criteria = [
        "Não existe senha, token ou chave fixa no código, documentação ou planilha versionável.",
        "Reiniciar a aplicação não modifica senhas nem dados de negócio.",
        "Anexos maliciosos não executam código na origem do HiperSales.",
        "Um tenant não consegue ler, alterar, associar, enviar ou inferir dados de outro tenant.",
        "Tenant suspenso não autentica e perde acesso em sessões existentes.",
        "Login possui limitação, monitoração e MFA para contas privilegiadas.",
        "Troca de senha revoga sessões anteriores e é imposta pelo backend.",
        "Cookie usa Secure, HttpOnly, SameSite e prefixo __Host- em HTTPS.",
        "Todas as operações mutáveis possuem proteção CSRF/origin.",
        "npm audit não apresenta vulnerabilidade alta ou crítica aplicável.",
        "Testes automatizados cobrem autorização, tenant, anexos, pedidos e integrações.",
        "Backup e restauração foram executados com sucesso em ambiente separado.",
        "Logs de auditoria permitem identificar autor, tenant, ação, data e resultado.",
    ]
    for item in criteria:
        r.bullet(item, marker="□")

    r.start_page("Mapa de evidências")
    r.heading("17. Mapa resumido de evidências")
    evidence = [
        "backend/app.py:259 — PBKDF2-HMAC-SHA256 com 150.000 iterações.",
        "backend/app.py:358-364 — unicidade global de CNPJ.",
        "backend/app.py:597-616 — criação/redefinição do superadministrador.",
        "backend/app.py:898-937 — fallback de configurações e tenant 1.",
        "backend/app.py:1593-1597 — substituição de template sem escape HTML.",
        "backend/app.py:1724-1796 — servidor HTTP e leitura integral do corpo.",
        "backend/app.py:1824-1832 — arquivos servidos inline pelo MIME informado.",
        "backend/app.py:1845-1918 — sessão e cookie sem Secure.",
        "backend/app.py:2917-2931 — upload aceita MIME do cliente.",
        "backend/app.py:3223-3245 — resposta inclui configuração SMTP.",
        "backend/app.py:3453-3494 — fila WhatsApp sem tenant.",
        "backend/app.py:4741-4746 — relatório semanal com 365 dias.",
        "backend/app.py:6312-6335 — scheduler semanal sem escopo de tenant.",
        "backend/app.py:6465-6471 — associação legada sem validação de tenant.",
        "backend/app.py:7672-7681 — schedulers e ThreadingHTTPServer.",
        "frontend/app.js:778-795 — escape HTML centralizado.",
        "whatsapp-service/index.mjs:44-57 — token interno em todas as chamadas.",
        "scripts/import_carga_leon.py:107-128 — importação redefine senhas.",
        "whatsapp-service/package-lock.json:1046 e 1133 — protobufjs e sharp vulneráveis.",
    ]
    for item in evidence:
        r.bullet(item)

    r.start_page("Conclusão")
    r.heading("18. Conclusão")
    r.paragraph(
        "O HiperSales possui valor funcional real e uma base capaz de evoluir. Os fluxos de clientes, produtos, pedidos, ocorrências e relatórios estão amplamente implementados, e há bons controles locais de SQL, sessões aleatórias, escape de interface e integridade do banco."
    )
    r.paragraph(
        "Entretanto, três condições impedem uma recomendação de produção pública no estado atual: a credencial fixa do superadministrador, a possibilidade de execução de JavaScript por anexos e o isolamento multiempresa incompleto. Esses pontos podem resultar em comprometimento administrativo, vazamento de dados e envio de informações pelo canal errado."
    )
    r.paragraph(
        "A recomendação é executar primeiro a contenção e o hotfix de segurança, preservando o escopo funcional. Depois, modularizar gradualmente o sistema com testes de autorização e tenant. Essa sequência reduz risco sem exigir uma reescrita imediata."
    )
    r.callout(
        "Parecer técnico final",
        "A aplicação pode continuar em uso controlado após contenção operacional, mas requer correções críticas antes de exposição pública ou ativação de múltiplos tenants. Uma nova revisão deve ser realizada após o hotfix e antes da liberação em produção.",
        RED,
    )
    r.y -= 28
    r.text(MARGIN_X, r.y, "Miguel Alameida", 14, "F2", NAVY)
    r.y -= 19
    r.text(MARGIN_X, r.y, "Desenvolvedor Nível 3", 10, "F1", MUTED)
    r.y -= 17
    r.text(MARGIN_X, r.y, "6 de outubro de 2026", 9, "F1", MUTED)

    r.finish()
    return OUTPUT


if __name__ == "__main__":
    path = build_report()
    print(path)
