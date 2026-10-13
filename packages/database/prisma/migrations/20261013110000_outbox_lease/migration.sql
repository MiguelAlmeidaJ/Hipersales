ALTER TABLE "email_outbox"
  ADD COLUMN "claimed_until" TIMESTAMPTZ(6);
CREATE INDEX "email_outbox_claimed_until_idx" ON "email_outbox" ("claimed_until");
