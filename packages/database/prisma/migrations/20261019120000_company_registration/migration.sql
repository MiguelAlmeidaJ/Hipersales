SET XACT_ABORT ON;
BEGIN TRANSACTION;
ALTER TABLE dbo.companies ADD
    trade_name NVARCHAR(180) NULL,
    cnpj NVARCHAR(180) NULL,
    state_registration NVARCHAR(180) NULL,
    tax_regime NVARCHAR(180) NULL,
    address NVARCHAR(240) NULL,
    address_number NVARCHAR(180) NULL,
    address_complement NVARCHAR(180) NULL,
    district NVARCHAR(180) NULL,
    city NVARCHAR(180) NULL,
    state NVARCHAR(180) NULL,
    postal_code NVARCHAR(180) NULL,
    phone NVARCHAR(180) NULL,
    email NVARCHAR(180) NULL,
    website NVARCHAR(180) NULL,
    lead_time_days INT NOT NULL CONSTRAINT companies_lead_time_days_df DEFAULT (0);
EXEC(N'ALTER TABLE dbo.companies ADD CONSTRAINT companies_lead_time_days_check CHECK (lead_time_days >= 0 AND lead_time_days <= 3650)');
COMMIT TRANSACTION;
