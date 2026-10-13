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
      // An atomic UPDATE/RETURNING and SKIP LOCKED prevent concurrent workers from
      // claiming the same row. Expired leases recover abandoned messages.
      const rows = await this.database.query(`WITH next_messages AS (
        SELECT id FROM email_outbox
        WHERE recipients NOT LIKE 'whatsapp:%'
          AND sent_at IS NULL
          AND COALESCE(attempts,0) < 5
          AND (claimed_until IS NULL OR claimed_until < NOW())
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT 10
      )
      UPDATE email_outbox AS outbox
      SET attempts=COALESCE(outbox.attempts,0)+1,
          claimed_until=NOW()+INTERVAL '5 minutes',
          error=NULL
      FROM next_messages
      WHERE outbox.id=next_messages.id
      RETURNING outbox.id,outbox.tenant_id,outbox.recipients,outbox.subject,outbox.body`) as unknown as OutboxRow[];
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
