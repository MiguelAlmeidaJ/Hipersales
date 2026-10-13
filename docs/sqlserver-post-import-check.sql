-- Validacao nao destrutiva do snapshot SQLite importado no SQL Server.
USE [hipersales];
GO
SELECT N'tenants' AS tabela, COUNT_BIG(*) AS registros FROM dbo.tenants
UNION ALL SELECT N'users', COUNT_BIG(*) FROM dbo.users
UNION ALL SELECT N'customers', COUNT_BIG(*) FROM dbo.customers
UNION ALL SELECT N'proposals', COUNT_BIG(*) FROM dbo.proposals
UNION ALL SELECT N'products', COUNT_BIG(*) FROM dbo.products
UNION ALL SELECT N'proposal_items', COUNT_BIG(*) FROM dbo.proposal_items
UNION ALL SELECT N'email_outbox', COUNT_BIG(*) FROM dbo.email_outbox
UNION ALL SELECT N'registration_requests', COUNT_BIG(*) FROM dbo.registration_requests;
GO
-- Checa todas as constraints sem modificar dados.
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
GO
-- Estado e valor atual das colunas IDENTITY apos importar IDs explicitos.
SELECT OBJECT_SCHEMA_NAME(ic.object_id) AS esquema,
       OBJECT_NAME(ic.object_id) AS tabela,
       ic.name AS coluna, ic.last_value AS ultimo_identity
FROM sys.identity_columns AS ic
WHERE OBJECT_SCHEMA_NAME(ic.object_id) = 'dbo'
ORDER BY tabela;
GO
-- Confirma que indices unicos de numero opcional sao filtrados.
SELECT OBJECT_NAME(object_id) AS tabela, name, is_unique, has_filter, filter_definition
FROM sys.indexes
WHERE name IN (N'UX_registration_requests_tenant_order_notnull', N'UX_proposals_tenant_order_notnull');
GO
