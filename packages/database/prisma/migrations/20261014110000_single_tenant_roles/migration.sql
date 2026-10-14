SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF (SELECT COUNT_BIG(*) FROM dbo.tenants) > 1
  THROW 51000, 'A conversao single-tenant exige apenas uma organizacao existente.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.tenants)
  INSERT INTO dbo.tenants (name, slug, status, created_at)
  VALUES (N'HiperMix', N'hipermix', N'active', SYSUTCDATETIME());

DECLARE @hipermix_tenant_id INT = (SELECT TOP (1) id FROM dbo.tenants);

UPDATE dbo.tenants
SET name = N'HiperMix', slug = N'hipermix', status = N'active'
WHERE id = @hipermix_tenant_id;

UPDATE dbo.users
SET tenant_id = @hipermix_tenant_id
WHERE tenant_id IS NULL;

UPDATE dbo.users
SET role = N'dev', is_dev = 1, is_super_admin = 0
WHERE is_dev = 1
   OR is_super_admin = 1
   OR LOWER(LTRIM(RTRIM(name))) = N'nivel3'
   OR LOWER(LTRIM(RTRIM(email))) = N'nivel3';

UPDATE dbo.users
SET is_dev = CASE WHEN role = N'dev' THEN 1 ELSE 0 END,
    is_super_admin = 0;

IF EXISTS (SELECT 1 FROM dbo.users WHERE role NOT IN (N'dev', N'admin', N'seller'))
  THROW 51001, 'Existem usuarios com perfil fora de dev, admin ou seller.', 1;

DROP INDEX users_tenant_id_role_active_idx ON dbo.users;
ALTER TABLE dbo.users ALTER COLUMN tenant_id INT NOT NULL;
CREATE NONCLUSTERED INDEX users_tenant_id_role_active_idx
  ON dbo.users (tenant_id, role, active);

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'users_role_check' AND parent_object_id = OBJECT_ID(N'dbo.users')
)
  ALTER TABLE dbo.users WITH CHECK
    ADD CONSTRAINT users_role_check CHECK (role IN (N'dev', N'admin', N'seller'));

COMMIT TRANSACTION;

EXEC(N'
CREATE OR ALTER TRIGGER dbo.tenants_singleton_guard
ON dbo.tenants
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  IF (SELECT COUNT_BIG(*) FROM dbo.tenants) <> 1
     OR EXISTS (SELECT 1 FROM dbo.tenants WHERE slug <> N''hipermix'')
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 51002, ''O HiperSales opera somente com a organizacao HiperMix.'', 1;
  END;
END
');
