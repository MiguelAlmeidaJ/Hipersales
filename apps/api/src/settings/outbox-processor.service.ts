import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { DatabaseRepository } from "../database/database.repository.js";
import { IntegrationsService } from "./integrations.service.js";

interface OutboxRow {
  id: number;
  tenant_id: number;
  recipients: string;
  subject: string;
  body: string;
}

@Injectable()
export class OutboxProcessorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly database: DatabaseRepository, private readonly integrations: IntegrationsService) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === "test" || process.env.HIPERSALES_OUTBOX_WORKER === "false") return;
    this.timer = setInterval(() => void this.processBatch(), 15_000);
    this.timer.unref();
    void this.processBatch();
  }

  onApplicationShutdown(): void { if (this.timer) clearInterval(this.timer); }

  async processBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      // UPDLOCK + READPAST claim rows atomically across concurrent SQL Server workers.
      // Expired leases recover messages left behind by an interrupted process.
      const rows = await this.database.claimEmailOutbox(10) as OutboxRow[];
      for (const row of rows) {
        try {
          await this.integrations.sendEmail(row.tenant_id, row);
          await this.database.db.prepare("UPDATE email_outbox SET sent_at=?,claimed_until=NULL,error=NULL WHERE id=?").run(new Date().toISOString(), row.id);
          sent++;
        } catch (error) {
          const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
          await this.database.db.prepare("UPDATE email_outbox SET claimed_until=NULL,error=? WHERE id=?").run(message, row.id);
        }
      }
      return sent;
    } finally { this.running = false; }
  }
}
