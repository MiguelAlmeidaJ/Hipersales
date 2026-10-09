import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class ProposalDeletionService {
  constructor(private readonly database: DatabaseService) {}

  delete(user: PublicUser, id: number): { message: string } {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException("Pedido invalido.");
    }
    return this.database.transaction(() => {
      const db = this.database.db;
      const found = db.prepare("SELECT id FROM proposals WHERE id=? AND tenant_id=?")
        .get(id, user.tenant_id);
      if (!found) throw new NotFoundException("Pedido nao encontrado.");
      db.prepare("DELETE FROM proposal_items WHERE proposal_id=?").run(id);
      db.prepare("DELETE FROM proposal_events WHERE proposal_id=?").run(id);
      db.prepare("DELETE FROM proposals WHERE id=? AND tenant_id=?").run(id, user.tenant_id);
      return { message: "Pedido excluido definitivamente." };
    });
  }
}
