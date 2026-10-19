SET XACT_ABORT ON;
BEGIN TRANSACTION;
CREATE TABLE dbo.proposal_invoice_files (
 proposal_id INT NOT NULL PRIMARY KEY,
 tenant_id INT NOT NULL,
 filename NVARCHAR(180) NOT NULL,
 mimetype NVARCHAR(80) NOT NULL,
 content VARBINARY(MAX) NOT NULL,
 uploaded_at DATETIME2 NOT NULL CONSTRAINT proposal_invoice_uploaded_df DEFAULT SYSUTCDATETIME(),
 CONSTRAINT proposal_invoice_proposal_fk FOREIGN KEY (proposal_id) REFERENCES dbo.proposals(id)
);
CREATE INDEX proposal_invoice_tenant_idx ON dbo.proposal_invoice_files(tenant_id);
COMMIT TRANSACTION;
