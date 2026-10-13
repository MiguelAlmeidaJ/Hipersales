-- Executar no banco hipersales apos criar as tabelas com Prisma.
-- Corrige diferenca de semantica UNIQUE nullable entre SQLite/PostgreSQL e SQL Server.
-- Idempotente quanto a existencia dos indices filtrados.
USE [hipersales];
GO

-- Falha rapidamente se ja existirem numeros duplicados nao nulos.
IF EXISTS (SELECT 1 FROM dbo.registration_requests WHERE order_number IS NOT NULL GROUP BY tenant_id, order_number HAVING COUNT(*) > 1)
    THROW 50001, 'Numeros nao nulos duplicados em registration_requests', 1;
IF EXISTS (SELECT 1 FROM dbo.proposals WHERE order_number IS NOT NULL GROUP BY tenant_id, order_number HAVING COUNT(*) > 1)
    THROW 50002, 'Numeros nao nulos duplicados em proposals', 1;
GO

-- Os indices UNIQUE originais podem existir como UNIQUE INDEX gerado pelo Prisma.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'registration_requests_tenant_id_order_number_key' AND object_id = OBJECT_ID('dbo.registration_requests'))
    DROP INDEX [registration_requests_tenant_id_order_number_key] ON dbo.registration_requests;
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'registration_requests_tenant_id_order_number_key' AND parent_object_id = OBJECT_ID('dbo.registration_requests'))
    ALTER TABLE dbo.registration_requests DROP CONSTRAINT [registration_requests_tenant_id_order_number_key];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'proposals_tenant_id_order_number_key' AND object_id = OBJECT_ID('dbo.proposals'))
    DROP INDEX [proposals_tenant_id_order_number_key] ON dbo.proposals;
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'proposals_tenant_id_order_number_key' AND parent_object_id = OBJECT_ID('dbo.proposals'))
    ALTER TABLE dbo.proposals DROP CONSTRAINT [proposals_tenant_id_order_number_key];
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_registration_requests_tenant_order_notnull' AND object_id = OBJECT_ID('dbo.registration_requests'))
    CREATE UNIQUE INDEX UX_registration_requests_tenant_order_notnull ON dbo.registration_requests (tenant_id, order_number) WHERE order_number IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_proposals_tenant_order_notnull' AND object_id = OBJECT_ID('dbo.proposals'))
    CREATE UNIQUE INDEX UX_proposals_tenant_order_notnull ON dbo.proposals (tenant_id, order_number) WHERE order_number IS NOT NULL;
GO
