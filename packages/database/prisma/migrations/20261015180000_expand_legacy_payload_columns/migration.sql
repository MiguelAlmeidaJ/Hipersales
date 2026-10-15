-- Bring SQL Server column types in line with the Prisma schema before importing legacy SQLite JSON and settings.
-- NVARCHAR(MAX) preserves long payloads instead of truncating customer registration data.
ALTER TABLE [dbo].[customers] ALTER COLUMN [form_payload] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[registration_requests] ALTER COLUMN [form_payload] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[tenant_settings] ALTER COLUMN [value] NVARCHAR(MAX) NOT NULL;
