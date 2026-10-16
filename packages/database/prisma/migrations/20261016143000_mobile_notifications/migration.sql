SET XACT_ABORT ON;

BEGIN TRANSACTION;

CREATE TABLE dbo.push_tokens (
  id INT IDENTITY(1,1) NOT NULL,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  token NVARCHAR(255) NOT NULL,
  platform NVARCHAR(20) NOT NULL,
  device_name NVARCHAR(191) NULL,
  active BIT NOT NULL CONSTRAINT push_tokens_active_df DEFAULT 1,
  last_seen_at DATETIME2 NOT NULL CONSTRAINT push_tokens_last_seen_at_df DEFAULT SYSUTCDATETIME(),
  created_at DATETIME2 NOT NULL CONSTRAINT push_tokens_created_at_df DEFAULT SYSUTCDATETIME(),
  CONSTRAINT push_tokens_pkey PRIMARY KEY CLUSTERED (id),
  CONSTRAINT push_tokens_token_key UNIQUE (token),
  CONSTRAINT push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES dbo.tenants(id),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE NONCLUSTERED INDEX push_tokens_user_id_active_idx ON dbo.push_tokens(user_id, active);
CREATE NONCLUSTERED INDEX push_tokens_tenant_id_active_idx ON dbo.push_tokens(tenant_id, active);

CREATE TABLE dbo.notifications (
  id INT IDENTITY(1,1) NOT NULL,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  kind NVARCHAR(50) NOT NULL,
  title NVARCHAR(191) NOT NULL,
  body NVARCHAR(MAX) NOT NULL,
  route NVARCHAR(191) NULL,
  data NVARCHAR(MAX) NULL,
  read_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL CONSTRAINT notifications_created_at_df DEFAULT SYSUTCDATETIME(),
  push_attempts INT NOT NULL CONSTRAINT notifications_push_attempts_df DEFAULT 0,
  push_sent_at DATETIME2 NULL,
  push_claimed_until DATETIME2 NULL,
  push_error NVARCHAR(1000) NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY CLUSTERED (id),
  CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES dbo.tenants(id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE NONCLUSTERED INDEX notifications_user_id_read_at_created_at_idx
  ON dbo.notifications(user_id, read_at, created_at DESC);
CREATE NONCLUSTERED INDEX notifications_push_sent_at_push_attempts_created_at_idx
  ON dbo.notifications(push_sent_at, push_attempts, created_at);
CREATE NONCLUSTERED INDEX notifications_push_claimed_until_idx ON dbo.notifications(push_claimed_until);

COMMIT TRANSACTION;
