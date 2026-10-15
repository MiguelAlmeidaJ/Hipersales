import { Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

type Data = Record<string, unknown>;

function payload(value: unknown): Data {
  try {
    const parsed: unknown = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Data : {};
  } catch { return {}; }
}

@Injectable()
export class RegistrationRequestsService {
  constructor(private readonly database: DatabaseRepository) {}

  async list(user: PublicUser) {
    const rows = await this.database.db.prepare(`
      SELECT rr.*, u.name AS seller_name,
        COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
        u.whatsapp_phone AS seller_whatsapp_phone
      FROM registration_requests rr
      JOIN users u ON u.id = rr.seller_id AND u.tenant_id = rr.tenant_id
      WHERE rr.tenant_id = ?
      ORDER BY rr.created_at DESC
    `).all(user.tenant_id);
    return { requests: (rows as Data[]).map(row => {
      const form = payload(row.form_payload);
      return {
        ...row,
        municipal_registration: form.municipal_registration ?? "",
        address: form.address ?? row.address,
        address_number: form.address_number ?? "",
        neighborhood: form.neighborhood ?? "",
        city: form.city ?? "",
        state: form.state ?? "",
        zip_code: form.zip_code ?? "",
        delivery_address: form.delivery_address ?? "",
        delivery_warnings: form.delivery_warnings ?? row.notes,
      };
    }) };
  }
}
