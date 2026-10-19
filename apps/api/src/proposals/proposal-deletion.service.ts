import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

@Injectable()
export class ProposalDeletionService {
  constructor(private readonly database: DatabaseRepository) {}

  delete(user: PublicUser, id: number): Promise<{ message: string }> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException("Pedido invalido.");
    }
    return this.database.transaction(async () => {
      const db = this.database.db;
      const found = await db.prepare("SELECT id FROM proposals WHERE id=? AND tenant_id=?")
        .get(id, user.tenant_id);
      if (!found) throw new NotFoundException("Pedido nao encontrado.");
      await db.prepare("DELETE FROM proposal_items WHERE proposal_id=?").run(id);
      await db.prepare("DELETE FROM proposal_events WHERE proposal_id=?").run(id);
      await db.prepare("DELETE FROM proposal_invoice_files WHERE proposal_id=? AND tenant_id=?").run(id,user.tenant_id);
      await db.prepare("DELETE FROM proposals WHERE id=? AND tenant_id=?").run(id, user.tenant_id);
      return { message: "Pedido excluido definitivamente." };
    });
  }
}
