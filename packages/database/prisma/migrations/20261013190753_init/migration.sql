BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[tenants] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [tenants_status_df] DEFAULT 'active',
    [owner_email] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [tenants_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tenants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenants_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT,
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(191) NOT NULL,
    [communication_email] NVARCHAR(1000),
    [whatsapp_phone] NVARCHAR(1000),
    [password_hash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [is_super_admin] BIT NOT NULL CONSTRAINT [users_is_super_admin_df] DEFAULT 0,
    [is_dev] BIT NOT NULL CONSTRAINT [users_is_dev_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [users_active_df] DEFAULT 1,
    [must_change_password] BIT NOT NULL CONSTRAINT [users_must_change_password_df] DEFAULT 0,
    [password_updated_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[sessions] (
    [token] NVARCHAR(191) NOT NULL,
    [user_id] INT NOT NULL,
    [expires_at] BIGINT NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sessions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sessions_pkey] PRIMARY KEY CLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[companies] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [legal_name] NVARCHAR(1000),
    [active] BIT NOT NULL CONSTRAINT [companies_active_df] DEFAULT 1,
    CONSTRAINT [companies_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[customers] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [legal_name] NVARCHAR(191) NOT NULL,
    [trade_name] NVARCHAR(1000),
    [cnpj] NVARCHAR(1000) NOT NULL,
    [state_registration] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [form_payload] NVARCHAR(1000),
    [active] BIT NOT NULL CONSTRAINT [customers_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [customers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [customers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [customers_tenant_id_cnpj_key] UNIQUE NONCLUSTERED ([tenant_id],[cnpj])
);

-- CreateTable
CREATE TABLE [dbo].[customer_sellers] (
    [customer_id] INT NOT NULL,
    [seller_id] INT NOT NULL,
    CONSTRAINT [customer_sellers_pkey] PRIMARY KEY CLUSTERED ([customer_id],[seller_id])
);

-- CreateTable
CREATE TABLE [dbo].[company_sellers] (
    [company_id] INT NOT NULL,
    [seller_id] INT NOT NULL,
    CONSTRAINT [company_sellers_pkey] PRIMARY KEY CLUSTERED ([company_id],[seller_id])
);

-- CreateTable
CREATE TABLE [dbo].[products] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [company_id] INT NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL CONSTRAINT [products_unit_df] DEFAULT 'UN',
    [price] DECIMAL(14,4) NOT NULL CONSTRAINT [products_price_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [products_active_df] DEFAULT 1,
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [products_company_id_code_key] UNIQUE NONCLUSTERED ([company_id],[code])
);

-- CreateTable
CREATE TABLE [dbo].[registration_requests] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [order_number] INT,
    [seller_id] INT NOT NULL,
    [legal_name] NVARCHAR(1000) NOT NULL,
    [trade_name] NVARCHAR(1000),
    [cnpj] NVARCHAR(1000) NOT NULL,
    [state_registration] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [form_payload] NVARCHAR(1000),
    [status] NVARCHAR(191) NOT NULL CONSTRAINT [registration_requests_status_df] DEFAULT 'pendente',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [registration_requests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [registration_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [registration_requests_tenant_id_order_number_key] UNIQUE NONCLUSTERED ([tenant_id],[order_number])
);

-- CreateTable
CREATE TABLE [dbo].[proposals] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [order_number] INT,
    [seller_id] INT NOT NULL,
    [company_id] INT NOT NULL,
    [customer_id] INT NOT NULL,
    [order_type] NVARCHAR(1000) NOT NULL,
    [purchase_order] NVARCHAR(1000),
    [commission_percent] DECIMAL(7,4) NOT NULL CONSTRAINT [proposals_commission_percent_df] DEFAULT 0,
    [invoice_type] NVARCHAR(1000) NOT NULL,
    [tax_operator_invoice] BIT NOT NULL CONSTRAINT [proposals_tax_operator_invoice_df] DEFAULT 0,
    [freight_type] NVARCHAR(1000) NOT NULL,
    [delivery_type] NVARCHAR(1000) NOT NULL,
    [scheduled_delivery_date] DATE,
    [discount_percent] DECIMAL(7,4) NOT NULL CONSTRAINT [proposals_discount_percent_df] DEFAULT 0,
    [discount_on] NVARCHAR(1000),
    [payment_terms] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [status] NVARCHAR(191) NOT NULL CONSTRAINT [proposals_status_df] DEFAULT 'em_analise',
    [admin_notes] NVARCHAR(1000),
    [delivery_forecast] NVARCHAR(1000),
    [industry_order_number] NVARCHAR(1000),
    [invoice_number] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [proposals_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [proposals_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [proposals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [proposals_tenant_id_order_number_key] UNIQUE NONCLUSTERED ([tenant_id],[order_number])
);

-- CreateTable
CREATE TABLE [dbo].[proposal_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [proposal_id] INT NOT NULL,
    [product_id] INT NOT NULL,
    [quantity] DECIMAL(14,4) NOT NULL,
    [negotiated_price] DECIMAL(14,4) NOT NULL,
    CONSTRAINT [proposal_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[proposal_events] (
    [id] INT NOT NULL IDENTITY(1,1),
    [proposal_id] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [created_by] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [proposal_events_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [proposal_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[email_outbox] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [recipients] NVARCHAR(1000) NOT NULL,
    [subject] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(1000) NOT NULL,
    [attempts] INT NOT NULL CONSTRAINT [email_outbox_attempts_df] DEFAULT 0,
    [sent_at] DATETIME2,
    [claimed_until] DATETIME2,
    [error] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [email_outbox_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [email_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[whatsapp_auto_replies] (
    [tenant_id] INT NOT NULL,
    [instance_id] NVARCHAR(191) NOT NULL,
    [message_id] NVARCHAR(191) NOT NULL,
    [remote_jid] NVARCHAR(1000) NOT NULL,
    [replied_at] DATETIME2 NOT NULL,
    CONSTRAINT [whatsapp_auto_replies_pkey] PRIMARY KEY CLUSTERED ([tenant_id],[instance_id],[message_id])
);

-- CreateTable
CREATE TABLE [dbo].[occurrences] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [seller_id] INT NOT NULL,
    [customer_id] INT NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [attachment_names] NVARCHAR(1000),
    [status] NVARCHAR(191) NOT NULL CONSTRAINT [occurrences_status_df] DEFAULT 'aberta',
    [resolution] NVARCHAR(1000),
    [resolved_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [occurrences_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [occurrences_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [occurrences_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[occurrence_attachments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [occurrence_id] INT NOT NULL,
    [tenant_id] INT NOT NULL,
    [filename] NVARCHAR(1000) NOT NULL,
    [mimetype] NVARCHAR(1000) NOT NULL,
    [content] VARBINARY(max) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [occurrence_attachments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [occurrence_attachments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[occurrence_events] (
    [id] INT NOT NULL IDENTITY(1,1),
    [occurrence_id] INT NOT NULL,
    [tenant_id] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [created_by] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [occurrence_events_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [occurrence_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_settings] (
    [key] NVARCHAR(191) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [system_settings_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [system_settings_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[tenant_settings] (
    [tenant_id] INT NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [tenant_settings_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [tenant_settings_pkey] PRIMARY KEY CLUSTERED ([tenant_id],[key])
);

-- CreateTable
CREATE TABLE [dbo].[seller_goals] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenant_id] INT NOT NULL,
    [seller_id] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [sales_goal] DECIMAL(14,4),
    [new_customers_goal] INT,
    [customer_positivation_goal] DECIMAL(14,4),
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [seller_goals_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [seller_goals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [seller_goals_tenant_id_seller_id_year_month_key] UNIQUE NONCLUSTERED ([tenant_id],[seller_id],[year],[month])
);

-- CreateTable
CREATE TABLE [dbo].[seller_goal_reminders] (
    [tenant_id] INT NOT NULL,
    [seller_id] INT NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [day] INT NOT NULL,
    [sent_at] DATETIME2 NOT NULL,
    CONSTRAINT [seller_goal_reminders_pkey] PRIMARY KEY CLUSTERED ([tenant_id],[seller_id],[year],[month],[day])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_tenant_id_role_active_idx] ON [dbo].[users]([tenant_id], [role], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_user_id_idx] ON [dbo].[sessions]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_expires_at_idx] ON [dbo].[sessions]([expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [companies_tenant_id_active_name_idx] ON [dbo].[companies]([tenant_id], [active], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customers_tenant_id_active_legal_name_idx] ON [dbo].[customers]([tenant_id], [active], [legal_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [customer_sellers_seller_id_idx] ON [dbo].[customer_sellers]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [company_sellers_seller_id_idx] ON [dbo].[company_sellers]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_tenant_id_company_id_active_name_idx] ON [dbo].[products]([tenant_id], [company_id], [active], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [registration_requests_tenant_id_seller_id_status_created_at_idx] ON [dbo].[registration_requests]([tenant_id], [seller_id], [status], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposals_tenant_id_seller_id_status_created_at_idx] ON [dbo].[proposals]([tenant_id], [seller_id], [status], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposals_tenant_id_company_id_created_at_idx] ON [dbo].[proposals]([tenant_id], [company_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposals_tenant_id_customer_id_created_at_idx] ON [dbo].[proposals]([tenant_id], [customer_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposal_items_proposal_id_idx] ON [dbo].[proposal_items]([proposal_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposal_items_product_id_idx] ON [dbo].[proposal_items]([product_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposal_events_proposal_id_created_at_idx] ON [dbo].[proposal_events]([proposal_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [proposal_events_created_by_idx] ON [dbo].[proposal_events]([created_by]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [email_outbox_sent_at_attempts_created_at_idx] ON [dbo].[email_outbox]([sent_at], [attempts], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [email_outbox_claimed_until_idx] ON [dbo].[email_outbox]([claimed_until]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [email_outbox_tenant_id_kind_created_at_idx] ON [dbo].[email_outbox]([tenant_id], [kind], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [whatsapp_auto_replies_replied_at_idx] ON [dbo].[whatsapp_auto_replies]([replied_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrences_tenant_id_seller_id_status_created_at_idx] ON [dbo].[occurrences]([tenant_id], [seller_id], [status], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrences_tenant_id_customer_id_created_at_idx] ON [dbo].[occurrences]([tenant_id], [customer_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrence_attachments_occurrence_id_idx] ON [dbo].[occurrence_attachments]([occurrence_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrence_attachments_tenant_id_created_at_idx] ON [dbo].[occurrence_attachments]([tenant_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrence_events_occurrence_id_created_at_idx] ON [dbo].[occurrence_events]([occurrence_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrence_events_tenant_id_created_at_idx] ON [dbo].[occurrence_events]([tenant_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [occurrence_events_created_by_idx] ON [dbo].[occurrence_events]([created_by]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [seller_goals_seller_id_idx] ON [dbo].[seller_goals]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [seller_goal_reminders_seller_id_idx] ON [dbo].[seller_goal_reminders]([seller_id]);

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[companies] ADD CONSTRAINT [companies_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customers] ADD CONSTRAINT [customers_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_sellers] ADD CONSTRAINT [customer_sellers_customer_id_fkey] FOREIGN KEY ([customer_id]) REFERENCES [dbo].[customers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[customer_sellers] ADD CONSTRAINT [customer_sellers_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[company_sellers] ADD CONSTRAINT [company_sellers_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[company_sellers] ADD CONSTRAINT [company_sellers_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[registration_requests] ADD CONSTRAINT [registration_requests_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[registration_requests] ADD CONSTRAINT [registration_requests_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposals] ADD CONSTRAINT [proposals_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposals] ADD CONSTRAINT [proposals_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposals] ADD CONSTRAINT [proposals_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposals] ADD CONSTRAINT [proposals_customer_id_fkey] FOREIGN KEY ([customer_id]) REFERENCES [dbo].[customers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposal_items] ADD CONSTRAINT [proposal_items_proposal_id_fkey] FOREIGN KEY ([proposal_id]) REFERENCES [dbo].[proposals]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposal_items] ADD CONSTRAINT [proposal_items_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposal_events] ADD CONSTRAINT [proposal_events_proposal_id_fkey] FOREIGN KEY ([proposal_id]) REFERENCES [dbo].[proposals]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proposal_events] ADD CONSTRAINT [proposal_events_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[email_outbox] ADD CONSTRAINT [email_outbox_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[whatsapp_auto_replies] ADD CONSTRAINT [whatsapp_auto_replies_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrences] ADD CONSTRAINT [occurrences_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrences] ADD CONSTRAINT [occurrences_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrences] ADD CONSTRAINT [occurrences_customer_id_fkey] FOREIGN KEY ([customer_id]) REFERENCES [dbo].[customers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrence_attachments] ADD CONSTRAINT [occurrence_attachments_occurrence_id_fkey] FOREIGN KEY ([occurrence_id]) REFERENCES [dbo].[occurrences]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrence_attachments] ADD CONSTRAINT [occurrence_attachments_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrence_events] ADD CONSTRAINT [occurrence_events_occurrence_id_fkey] FOREIGN KEY ([occurrence_id]) REFERENCES [dbo].[occurrences]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrence_events] ADD CONSTRAINT [occurrence_events_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[occurrence_events] ADD CONSTRAINT [occurrence_events_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tenant_settings] ADD CONSTRAINT [tenant_settings_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[seller_goals] ADD CONSTRAINT [seller_goals_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[seller_goals] ADD CONSTRAINT [seller_goals_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[seller_goal_reminders] ADD CONSTRAINT [seller_goal_reminders_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[seller_goal_reminders] ADD CONSTRAINT [seller_goal_reminders_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
