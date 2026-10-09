import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

type ProposalMailRow = {
  seller_name:string;
  customer_name:string;
  cnpj:string;
};

export function proposalEmailSubject(row: ProposalMailRow, prefix = "NOVA PROPOSTA"): string {
  return `${prefix} ${row.customer_name} + ${row.cnpj}`;
}

export function proposalEmailBody(row: ProposalMailRow): string {
  return [
    "Ola, Thalles.",
    `Voce esta recebendo uma nova proposta enviada por ${row.seller_name} para analise do cliente ${row.customer_name} - CNPJ ${row.cnpj}.`,
    "Por favor, verificar na plataforma do administrador para dar andamento a analise.",
    "Atenciosamente,",
    "Comunicacao HiperSales Web",
  ].join("\n");
}

@Injectable()
export class ProposalNotificationService {
  constructor(private readonly database: DatabaseService) {}

  queueNewProposal(tenantId:number, proposalId:number):void {
    const db=this.database.db;
    const row=db.prepare(`SELECT u.name AS seller_name, c.legal_name AS customer_name, c.cnpj
      FROM proposals p JOIN users u ON u.id=p.seller_id
      JOIN customers c ON c.id=p.customer_id
      WHERE p.id=? AND p.tenant_id=?`).get(proposalId,tenantId) as ProposalMailRow|undefined;
    if(!row) throw new Error("Dados obrigatorios do email de proposta nao encontrados.");
    db.prepare(`INSERT INTO email_outbox
      (tenant_id,kind,recipients,subject,body,created_at)
      VALUES (?,?,?,?,?,?)`).run(
      tenantId,"new_proposal_admin","thallesmachadocomercial@gmail.com",
      proposalEmailSubject(row),proposalEmailBody(row),new Date().toISOString(),
    );
  }
}
