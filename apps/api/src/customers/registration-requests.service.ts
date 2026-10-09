import { Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class RegistrationRequestsService {
  constructor(private readonly database: DatabaseService) {}

  list(user: PublicUser) {
    const rows = this.database.db.prepare(`
      SELECT rr.*, u.name AS seller_name,
        COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
        u.whatsapp_phone AS seller_whatsapp_phone
      FROM registration_requests rr
      JOIN users u ON u.id = rr.seller_id AND u.tenant_id = rr.tenant_id
      WHERE rr.tenant_id = ?
      ORDER BY rr.created_at DESC
    `).all(user.tenant_id);
    return { requests: rows };
  }
}
