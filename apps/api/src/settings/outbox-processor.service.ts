import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
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

  constructor(private readonly database: DatabaseService, private readonly integrations: IntegrationsService) {}

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
      const rows = this.database.db.prepare(`SELECT id,tenant_id,recipients,subject,body FROM email_outbox
        WHERE recipients NOT LIKE 'whatsapp:%' AND sent_at IS NULL AND COALESCE(attempts,0)<5
        ORDER BY id LIMIT 10`).all() as unknown as OutboxRow[];
      for (const row of rows) {
        const claimed = this.database.db.prepare(`UPDATE email_outbox SET attempts=COALESCE(attempts,0)+1,error=NULL
          WHERE id=? AND sent_at IS NULL AND COALESCE(attempts,0)<5`).run(row.id);
        if (!claimed.changes) continue;
        try {
          await this.integrations.sendEmail(row.tenant_id, row);
          this.database.db.prepare("UPDATE email_outbox SET sent_at=?,error=NULL WHERE id=?").run(new Date().toISOString(), row.id);
          sent++;
        } catch (error) {
          const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
          this.database.db.prepare("UPDATE email_outbox SET error=? WHERE id=?").run(message, row.id);
        }
      }
      return sent;
    } finally { this.running = false; }
  }
}
