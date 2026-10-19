import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

type Row = Record<string, unknown>;
const value = (input: unknown) => String(input ?? "").trim() || "-";
const date = (input: unknown) => {
  const result = new Date(String(input ?? ""));
  return Number.isNaN(result.getTime()) ? "-" : result.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

@Injectable()
export class OccurrencePdfService {
  constructor(private readonly database: DatabaseRepository) {}

  async generate(user: PublicUser, id: number): Promise<Buffer> {
    const row = await this.database.db.prepare(`SELECT o.*, u.name AS seller_name,
      c.legal_name AS customer_name, c.trade_name AS customer_trade_name,
      c.cnpj AS customer_cnpj, c.state_registration AS customer_state_registration,
      c.address AS customer_address, c.phone AS customer_phone, c.email AS customer_email
      FROM occurrences o
      JOIN users u ON u.id = o.seller_id AND u.tenant_id = o.tenant_id
      JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      WHERE o.id = ? AND o.tenant_id = ?`).get(id, user.tenant_id) as Row | undefined;
    if (!row) throw new NotFoundException("Ocorrencia nao encontrada.");
    if (!hasAdminAccess(user.role) && Number(row.seller_id) !== user.id)
      throw new ForbiddenException("Sem acesso a esta ocorrencia.");
    const files = await this.database.db.prepare(
      "SELECT filename FROM occurrence_attachments WHERE occurrence_id=? AND tenant_id=? ORDER BY id"
    ).all(id, user.tenant_id) as Row[];
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 38, info: { Title: `Registro de Ocorrencia RO ${id}` } });
      const parts: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => parts.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(parts)));
      doc.on("error", reject);
      const left = 38, right = 557, width = right - left;
      const line = () => { doc.moveDown(.55); doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).stroke("#1F2937"); doc.moveDown(.65); };
      const pair = (label: string, data: unknown) => {
        doc.font("Helvetica-Bold").fontSize(9).text(label + ": ", { continued: true });
        doc.font("Helvetica").text(value(data));
      };
      const heading = (title: string) => doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(title).moveDown(.4);
      doc.font("Helvetica-Bold").fontSize(15).text("REGISTRO DE OCORRÊNCIA", left, 40);
      doc.fontSize(11).text(`R.O. ${String(id).padStart(4, "0")}`, left, 43, { width, align: "right" });
      doc.y = 75; line();
      heading("CLIENTE");
      pair("Razão social", row.customer_name);
      pair("Fantasia", row.customer_trade_name);
      pair("CNPJ", row.customer_cnpj);
      pair("Inscrição estadual", row.customer_state_registration);
      pair("Endereço", row.customer_address);
      pair("Telefone", row.customer_phone);
      pair("E-mail", row.customer_email);
      line();
      heading("DETALHES DA OCORRÊNCIA");
      pair("Criada em", date(row.created_at));
      pair("Representante", row.seller_name);
      pair("Status", row.status);
      pair("Motivo", row.reason);
      pair("Data da resolução", row.resolved_at ? date(row.resolved_at) : "-");
      pair("Anexos", files.length ? files.map(file => value(file.filename)).join(", ") : "Não");
      line();
      heading("RELATO DA OCORRÊNCIA");
      doc.font("Helvetica").fontSize(10).text(value(row.description), { width, lineGap: 3 });
      doc.moveDown(2); line();
      heading("PARECER FINAL");
      doc.font("Helvetica").fontSize(10).text(value(row.resolution), { width, lineGap: 3 });
      doc.end();
    });
  }
}
