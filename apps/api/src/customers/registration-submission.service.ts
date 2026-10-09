import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { CnpjLookupService } from "./cnpj-lookup.service.js";
import { customerAddress, customerText } from "./customer-fields.js";

export type RegistrationInput = Record<string, unknown> & {
  legal_name?: string;
  cnpj?: string;
  contact_person?: string;
  phone_1?: string;
};

@Injectable()
export class RegistrationSubmissionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: CnpjLookupService,
  ) {}

  async submit(user: PublicUser, input: RegistrationInput) {
    if (user.role !== "seller") {
      throw new ForbiddenException("Solicitacao de cadastro disponivel apenas para representantes comerciais.");
    }
    const legalName = customerText(input?.legal_name);
    const cnpj = customerText(input?.cnpj);
    const contact = customerText(input?.contact_person);
    const phone = customerText(input?.phone_1);
    if (!legalName || !cnpj || !contact || !phone) {
      throw new BadRequestException("Informe razao social, CNPJ, contato e telefone.");
    }

    // Duplicate checks and the external lookup match the historical submission flow.
    // Keep network I/O outside the transaction.
    const external = await this.lookup.lookup(user.tenant_id, cnpj);
    const representativeEmail = customerText(
      user.communication_email, input.representative_email, user.email,
    );
    const form = {
      ...input,
      representative_name: user.name || input.representative_name,
      representative_email: representativeEmail,
    };
    const data = { ...form, _lookup: external };
    const name = customerText(form.legal_name, external.legal_name);
    const address = customerText(customerAddress(form), external.address);
    const email = customerText(
      form.purchase_email, form.billing_email, form.xml_email, external.email,
    );

    return this.database.transaction(() => {
      const records = this.database.db.prepare(
        "SELECT cnpj FROM customers WHERE tenant_id = ?",
      ).all(user.tenant_id) as { cnpj: string }[];
      const digits = cnpj.replace(/\D/g, "");
      if (records.some(row => row.cnpj.replace(/\D/g, "") === digits)) {
        throw new ConflictException("Ja existe esse CNPJ na nossa base.");
      }
      const result = this.database.db.prepare(`INSERT INTO registration_requests
        (tenant_id, seller_id, legal_name, trade_name, cnpj, state_registration,
         address, phone, email, notes, form_payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        user.tenant_id, user.id, name, customerText(form.trade_name, external.trade_name),
        cnpj, customerText(form.state_registration, external.state_registration),
        address, phone, email, customerText(form.delivery_warnings, form.notes),
        JSON.stringify(data), new Date().toISOString(),
      );
      // Preserve the legacy's transactional outbox rather than sending email inside HTTP request.
      // Full HTML template parity is tracked separately; keep this route gated until verified.
      const body = [
        "Solicitacao de cadastro recebida.",
        `Representante: ${customerText(user.name)}`,
        `Cliente: ${name}`,
        `CNPJ: ${cnpj}`,
        `Contato: ${contact}`,
        `Telefone: ${phone}`,
      ].join("\n");
      this.database.db.prepare(`INSERT INTO email_outbox
        (tenant_id, kind, recipients, subject, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        user.tenant_id, "customer_request",
        "vendas@hipermixrepresentacoes.com.br,thallesmachadocomercial@gmail.com",
        `SOLICITACAO DE CADASTRO ${name}`, body, new Date().toISOString(),
      );
      return { id: Number(result.lastInsertRowid), message: "Solicitacao enviada para o back office." };
    });
  }
}
