-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "communication_email" TEXT,
    "whatsapp_phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_dev" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_updated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "cnpj" TEXT NOT NULL,
    "state_registration" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "form_payload" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sellers" (
    "customer_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,

    CONSTRAINT "customer_sellers_pkey" PRIMARY KEY ("customer_id","seller_id")
);

-- CreateTable
CREATE TABLE "company_sellers" (
    "company_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,

    CONSTRAINT "company_sellers_pkey" PRIMARY KEY ("company_id","seller_id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "price" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "order_number" INTEGER,
    "seller_id" INTEGER NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "cnpj" TEXT NOT NULL,
    "state_registration" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "form_payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "order_number" INTEGER,
    "seller_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "order_type" TEXT NOT NULL,
    "purchase_order" TEXT,
    "commission_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "invoice_type" TEXT NOT NULL,
    "tax_operator_invoice" BOOLEAN NOT NULL DEFAULT false,
    "freight_type" TEXT NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "scheduled_delivery_date" DATE,
    "discount_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "discount_on" TEXT,
    "payment_terms" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'em_analise',
    "admin_notes" TEXT,
    "delivery_forecast" TEXT,
    "industry_order_number" TEXT,
    "invoice_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" SERIAL NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "negotiated_price" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_events" (
    "id" SERIAL NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_auto_replies" (
    "tenant_id" INTEGER NOT NULL,
    "instance_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "remote_jid" TEXT NOT NULL,
    "replied_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_auto_replies_pkey" PRIMARY KEY ("tenant_id","instance_id","message_id")
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachment_names" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_attachments" (
    "id" SERIAL NOT NULL,
    "occurrence_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_events" (
    "id" SERIAL NOT NULL,
    "occurrence_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "tenant_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "seller_goals" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sales_goal" DECIMAL(14,4),
    "new_customers_goal" INTEGER,
    "customer_positivation_goal" DECIMAL(14,4),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_goal_reminders" (
    "tenant_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seller_goal_reminders_pkey" PRIMARY KEY ("tenant_id","seller_id","year","month","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_active_idx" ON "users"("tenant_id", "role", "active");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "companies_tenant_id_active_name_idx" ON "companies"("tenant_id", "active", "name");

-- CreateIndex
CREATE INDEX "customers_tenant_id_active_legal_name_idx" ON "customers"("tenant_id", "active", "legal_name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_cnpj_key" ON "customers"("tenant_id", "cnpj");

-- CreateIndex
CREATE INDEX "customer_sellers_seller_id_idx" ON "customer_sellers"("seller_id");

-- CreateIndex
CREATE INDEX "company_sellers_seller_id_idx" ON "company_sellers"("seller_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_company_id_active_name_idx" ON "products"("tenant_id", "company_id", "active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_code_key" ON "products"("company_id", "code");

-- CreateIndex
CREATE INDEX "registration_requests_tenant_id_seller_id_status_created_at_idx" ON "registration_requests"("tenant_id", "seller_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_tenant_id_order_number_key" ON "registration_requests"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "proposals_tenant_id_seller_id_status_created_at_idx" ON "proposals"("tenant_id", "seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "proposals_tenant_id_company_id_created_at_idx" ON "proposals"("tenant_id", "company_id", "created_at");

-- CreateIndex
CREATE INDEX "proposals_tenant_id_customer_id_created_at_idx" ON "proposals"("tenant_id", "customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_tenant_id_order_number_key" ON "proposals"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "proposal_items_proposal_id_idx" ON "proposal_items"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_items_product_id_idx" ON "proposal_items"("product_id");

-- CreateIndex
CREATE INDEX "proposal_events_proposal_id_created_at_idx" ON "proposal_events"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_events_created_by_idx" ON "proposal_events"("created_by");

-- CreateIndex
CREATE INDEX "email_outbox_sent_at_attempts_created_at_idx" ON "email_outbox"("sent_at", "attempts", "created_at");

-- CreateIndex
CREATE INDEX "email_outbox_tenant_id_kind_created_at_idx" ON "email_outbox"("tenant_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_auto_replies_replied_at_idx" ON "whatsapp_auto_replies"("replied_at");

-- CreateIndex
CREATE INDEX "occurrences_tenant_id_seller_id_status_created_at_idx" ON "occurrences"("tenant_id", "seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "occurrences_tenant_id_customer_id_created_at_idx" ON "occurrences"("tenant_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "occurrence_attachments_occurrence_id_idx" ON "occurrence_attachments"("occurrence_id");

-- CreateIndex
CREATE INDEX "occurrence_attachments_tenant_id_created_at_idx" ON "occurrence_attachments"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "occurrence_events_occurrence_id_created_at_idx" ON "occurrence_events"("occurrence_id", "created_at");

-- CreateIndex
CREATE INDEX "occurrence_events_tenant_id_created_at_idx" ON "occurrence_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "occurrence_events_created_by_idx" ON "occurrence_events"("created_by");

-- CreateIndex
CREATE INDEX "seller_goals_seller_id_idx" ON "seller_goals"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_goals_tenant_id_seller_id_year_month_key" ON "seller_goals"("tenant_id", "seller_id", "year", "month");

-- CreateIndex
CREATE INDEX "seller_goal_reminders_seller_id_idx" ON "seller_goal_reminders"("seller_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sellers" ADD CONSTRAINT "customer_sellers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sellers" ADD CONSTRAINT "customer_sellers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_sellers" ADD CONSTRAINT "company_sellers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_sellers" ADD CONSTRAINT "company_sellers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_auto_replies" ADD CONSTRAINT "whatsapp_auto_replies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_attachments" ADD CONSTRAINT "occurrence_attachments_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_attachments" ADD CONSTRAINT "occurrence_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_events" ADD CONSTRAINT "occurrence_events_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_events" ADD CONSTRAINT "occurrence_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_events" ADD CONSTRAINT "occurrence_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goals" ADD CONSTRAINT "seller_goals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goals" ADD CONSTRAINT "seller_goals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goal_reminders" ADD CONSTRAINT "seller_goal_reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goal_reminders" ADD CONSTRAINT "seller_goal_reminders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
