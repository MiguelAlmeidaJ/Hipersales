from __future__ import annotations

import ast
import hashlib
from pathlib import Path


# O script fica em scripts/, diretamente abaixo da raiz da aplicacao.
ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
SOURCE = BACKEND / "app.py"
BACKUP_DIR = ROOT / ".refactor-backup"
BACKUP = BACKUP_DIR / "backend_app_original.py"

EXPECTED_SHA256 = "E29397A2F0CA6A87D54A693AC782E04C76D98EBD087679FEBC9F1D3FC50593B8"

GROUPS = [
    ("http_handler.py", "HttpHandlerMixin", "__init__", "route_api", "Transporte HTTP, autenticação de sessão e roteamento da API."),
    ("tenant_goals.py", "TenantGoalsMixin", "super_admin_overview", "save_admin_goals", "Superadministração, dashboard e metas comerciais."),
    ("sales.py", "SalesMixin", "customers", "proposal_pdf", "Consultas comerciais, propostas, ocorrências e seus PDFs."),
    ("admin_dashboard.py", "AdminDashboardMixin", "admin_summary", "update_whatsapp_outbox", "Visão administrativa, configurações e integração WhatsApp."),
    ("catalog_admin.py", "CatalogAdminMixin", "admin_companies", "change_own_password", "Administração de catálogo, vínculos e usuários."),
    ("order_admin.py", "OrderAdminMixin", "update_registration_request", "unwrap_cnpj_payload", "Aprovações, pedidos, clientes e consulta de CNPJ."),
    ("report_data.py", "ReportDataMixin", "weekly_report_period", "admin_report_data", "Coleta e consolidação de dados para relatórios."),
    ("report_pdf.py", "ReportPdfMixin", "admin_followup_report_pdf", "weekly_seller_report_pdf", "Renderização dos relatórios em PDF."),
    ("background_jobs.py", "BackgroundJobsMixin", "run_weekly_reports", "assign_customer", "Rotinas de relatórios, lembretes e operação legada."),
]


def digest(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest().upper()


def node_start(node: ast.AST) -> int:
    decorators = getattr(node, "decorator_list", [])
    return min([node.lineno, *(item.lineno for item in decorators)])


def source_segment(lines: list[str], node: ast.AST) -> str:
    start = node_start(node) - 1
    end = node.end_lineno
    return "\n".join(lines[start:end]).rstrip()


def compat_import(module: str, names: str = "*") -> str:
    return (
        "try:\n"
        f"    from .{module} import {names}\n"
        "except ImportError:  # Execução direta: python backend/app.py\n"
        f"    from {module} import {names}\n"
    )


def write_module(path: Path, docstring: str, imports: str, body: str) -> None:
    content = (
        "from __future__ import annotations\n\n"
        f'"""{docstring}"""\n\n'
        f"{imports.rstrip()}\n\n\n"
        f"{body.rstrip()}\n"
    )
    path.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    original = SOURCE.read_text(encoding="utf-8")
    current_hash = digest(original)
    if current_hash != EXPECTED_SHA256:
        raise SystemExit(
            "backend/app.py não corresponde à versão auditada. "
            f"Esperado {EXPECTED_SHA256}, encontrado {current_hash}."
        )

    BACKUP_DIR.mkdir(exist_ok=True)
    if BACKUP.exists() and digest(BACKUP.read_text(encoding="utf-8")) != EXPECTED_SHA256:
        raise SystemExit(f"Backup existente não corresponde ao original: {BACKUP}")
    if not BACKUP.exists():
        BACKUP.write_text(original, encoding="utf-8", newline="\n")

    tree = ast.parse(original)
    lines = original.splitlines()
    handler = next(
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "HypersalesHandler"
    )
    methods = [
        node for node in handler.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    method_names = [node.name for node in methods]

    assigned: list[str] = []
    class_names: list[str] = []
    module_names: list[str] = []
    for filename, class_name, first_name, last_name, description in GROUPS:
        start = method_names.index(first_name)
        end = method_names.index(last_name)
        if end < start:
            raise SystemExit(f"Grupo inválido: {class_name}")
        selected = methods[start : end + 1]
        assigned.extend(node.name for node in selected)
        class_names.append(class_name)
        module_names.append(Path(filename).stem)
        body = f"class {class_name}:\n" + "\n\n".join(source_segment(lines, node) for node in selected) + "\n"
        write_module(
            BACKEND / filename,
            description,
            compat_import("shared"),
            body,
        )

    if assigned != method_names:
        missing = [name for name in method_names if name not in assigned]
        duplicates = [name for name in assigned if assigned.count(name) > 1]
        raise SystemExit(f"Particionamento incompleto. Ausentes={missing}; duplicados={sorted(set(duplicates))}")

    required_node = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "required")
    format_email_node = next(
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "format_proposal_email"
    )
    documents_body = "\n".join(lines[required_node.lineno - 1 : format_email_node.end_lineno])

    foundation_body = "\n".join(lines[: handler.lineno - 1]).rstrip()
    write_module(
        BACKEND / "foundation.py",
        "Configuração, persistência, segurança, settings e integrações compartilhadas.",
        "",
        foundation_body.removeprefix("from __future__ import annotations\n\n"),
    )
    write_module(
        BACKEND / "documents.py",
        "Formatação de mensagens, pedidos, datas e documentos PDF.",
        compat_import("foundation"),
        documents_body,
    )

    shared_imports = compat_import("foundation") + "\n" + compat_import("documents")
    write_module(
        BACKEND / "shared.py",
        "Superfície compartilhada para os módulos do backend.",
        shared_imports,
        "",
    )

    imports: list[str] = [compat_import("shared")]
    for module_name, class_name in zip(module_names, class_names):
        imports.append(compat_import(module_name, class_name))

    class_block = "class HypersalesHandler(\n"
    for class_name in class_names:
        class_block += f"    {class_name},\n"
    class_block += "    SimpleHTTPRequestHandler,\n):\n"
    class_block += '    """Handler composto pelos módulos de domínio, preservando a API original."""\n\n'
    class_block += "    pass\n"

    scheduler_node = next(
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "weekly_report_scheduler"
    )
    scheduler_body = "\n".join(lines[scheduler_node.lineno - 1 :]).rstrip()
    app_content = (
        "from __future__ import annotations\n\n"
        '"""Ponto de entrada e composição do backend HiperSales."""\n\n'
        + "\n".join(item.rstrip() for item in imports)
        + "\n\n\n"
        + class_block
        + "\n\n"
        + scheduler_body
        + "\n"
    )
    SOURCE.write_text(app_content, encoding="utf-8", newline="\n")

    init_file = BACKEND / "__init__.py"
    if not init_file.exists():
        init_file.write_text('"""Backend do HiperSales."""\n', encoding="utf-8", newline="\n")

    readme = BACKUP_DIR / "README.txt"
    readme.write_text(
        "Backup criado automaticamente antes da modularização do backend.\n"
        f"Origem: {SOURCE}\n"
        f"SHA-256 original: {EXPECTED_SHA256}\n"
        "O arquivo é somente para recuperação e não participa da aplicação.\n",
        encoding="utf-8",
        newline="\n",
    )

    print(f"Refatoração concluída. Métodos distribuídos: {len(method_names)}")
    print(f"Backup: {BACKUP}")


if __name__ == "__main__":
    main()
