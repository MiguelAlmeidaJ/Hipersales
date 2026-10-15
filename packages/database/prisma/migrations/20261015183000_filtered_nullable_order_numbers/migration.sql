-- SQL Server UNIQUE constraints accept only one NULL per tenant.
-- Nullable order numbers must be unique only after a number is assigned.
ALTER TABLE [dbo].[registration_requests]
  DROP CONSTRAINT [registration_requests_tenant_id_order_number_key];

CREATE UNIQUE NONCLUSTERED INDEX [registration_requests_tenant_id_order_number_key]
  ON [dbo].[registration_requests] ([tenant_id], [order_number])
  WHERE [order_number] IS NOT NULL;

ALTER TABLE [dbo].[proposals]
  DROP CONSTRAINT [proposals_tenant_id_order_number_key];

CREATE UNIQUE NONCLUSTERED INDEX [proposals_tenant_id_order_number_key]
  ON [dbo].[proposals] ([tenant_id], [order_number])
  WHERE [order_number] IS NOT NULL;
