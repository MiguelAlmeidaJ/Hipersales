import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { customerAddress, customerText } from "./customer-fields.js";

type Data = Record<string, unknown>;

const obj = (v: unknown): Data => {
  if (typeof v === "string") { try { return obj(JSON.parse(v)); } catch { return {}; } }
  return v && typeof v === "object" && !Array.isArray(v) ? v as Data : {};
};
const cnpjDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

@Injectable()
export class RegistrationReviewService {
  constructor(private readonly database: DatabaseService) {}

  review(user: PublicUser, id: number, data: Data) {
    if (!Number.isSafeInteger(id) || id <= 0 || !data || typeof data !== "object" || Array.isArray(data))
      throw new BadRequestException("Solicitacao invalida.");
    return this.database.transaction(() => {
      const db = this.database.db;
      const original = db.prepare("SELECT * FROM registration_requests WHERE id=? AND tenant_id=?")
        .get(id, user.tenant_id) as Data | undefined;
      if (!original) throw new NotFoundException("Solicitacao nao encontrada.");
      const status = String(data.status ?? original.status);
      if (!["pendente", "aprovada", "recusada"].includes(status))
        throw new BadRequestException("Status invalido.");

      const payload: Data = {...obj(original.form_payload), ...obj(data.form_payload)};
      const lookup = obj(payload._lookup);
      const get = (field: string, ...fallback: string[]) => {
        if (Object.prototype.hasOwnProperty.call(data,field)) return data[field];
        for(const key of [field,...fallback]) if (key in payload) return payload[key];
        for(const key of [field,...fallback]) if (key in original) return original[key];
        return "";
      };
      const editable = {
        legal_name: get("legal_name"), trade_name: get("trade_name"),
        cnpj: get("cnpj"), state_registration: get("state_registration"),
        address: get("address"), phone_1: get("phone_1","phone"),
        purchase_email: get("purchase_email","email"),
        delivery_warnings: get("delivery_warnings","notes"),
      };
      const address = customerText(customerAddress({
        address: data.address || payload.address || lookup.address_line || lookup.address,
        neighborhood: data.neighborhood || payload.neighborhood || payload.bairro || lookup.neighborhood,
        city: data.city || payload.city || lookup.city,
        state: data.state || payload.state || lookup.state,
        zip_code: data.zip_code || payload.zip_code || lookup.zip_code,
      }), editable.address);
      const rest: Data = {...data};
      delete rest.status;
      delete rest.form_payload;
      const formPayload = JSON.stringify({...payload,...rest,...editable});

      db.prepare(`UPDATE registration_requests SET legal_name=?,trade_name=?,cnpj=?,
        state_registration=?,address=?,phone=?,email=?,notes=?,form_payload=?,status=?
        WHERE id=? AND tenant_id=?`).run(
          editable.legal_name as string,editable.trade_name as string,editable.cnpj as string,
          editable.state_registration as string,address,editable.phone_1 as string,
          editable.purchase_email as string,editable.delivery_warnings as string,
          formPayload,status,id,user.tenant_id,
        );

      if (status === "aprovada") {
        const currentCnpj = cnpjDigits(editable.cnpj);
        if (currentCnpj.length !== 14) throw new BadRequestException("Informe um CNPJ valido.");
        const customers = db.prepare("SELECT id,cnpj FROM customers WHERE tenant_id=?")
          .all(user.tenant_id) as {id:number;cnpj:string}[];
        const matched = customers.filter(c => cnpjDigits(c.cnpj) === currentCnpj);
        if (matched.length > 1) throw new ConflictException("Ja existe esse CNPJ na nossa base.");
        const existing = matched[0];
        let customerId: number;
        if (existing) {
          customerId = existing.id;
          db.prepare(`UPDATE customers SET legal_name=?,trade_name=?,state_registration=?,address=?,
            phone=?,email=?,form_payload=?,active=1 WHERE id=? AND tenant_id=?`).run(
              editable.legal_name as string,editable.trade_name as string,
              editable.state_registration as string,address,editable.phone_1 as string,
              editable.purchase_email as string,formPayload,customerId,user.tenant_id,
            );
        } else {
          const result = db.prepare(`INSERT INTO customers
            (tenant_id,legal_name,trade_name,cnpj,state_registration,address,phone,email,form_payload,active,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,1,?)`).run(
              user.tenant_id,editable.legal_name as string,editable.trade_name as string,
              editable.cnpj as string,editable.state_registration as string,address,
              editable.phone_1 as string,editable.purchase_email as string,
              formPayload,new Date().toISOString(),
            );
          customerId = Number(result.lastInsertRowid);
        }
        db.prepare("INSERT OR IGNORE INTO customer_sellers (customer_id,seller_id) VALUES (?,?)")
          .run(customerId,Number(original.seller_id));
        // Notification template and WhatsApp parity is not yet validated:
        // the proxy must not route approvals here until this is implemented.
      }
      return {message:"Solicitacao atualizada."};
    });
  }
}
