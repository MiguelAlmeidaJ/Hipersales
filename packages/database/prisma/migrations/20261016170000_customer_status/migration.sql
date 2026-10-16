SET XACT_ABORT ON;

BEGIN TRANSACTION;

ALTER TABLE dbo.customers
ADD status NVARCHAR(20) NOT NULL
    CONSTRAINT customers_status_df DEFAULT N'ativo';

EXEC(N'
    UPDATE dbo.customers
    SET status = CASE
        WHEN active = 1 THEN N''ativo''
        ELSE N''inativo''
    END;
');

EXEC(N'
    ALTER TABLE dbo.customers
    ADD CONSTRAINT customers_status_check
    CHECK (status IN (N''ativo'', N''inativo'', N''bloqueado''));
');

EXEC(N'
    CREATE NONCLUSTERED INDEX customers_tenant_id_status_legal_name_idx
    ON dbo.customers(tenant_id, status, legal_name);
');

COMMIT TRANSACTION;
