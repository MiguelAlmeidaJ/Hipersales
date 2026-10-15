ALTER TABLE [products] ADD
  [product_group] NVARCHAR(120) NULL,
  [subgroup] NVARCHAR(160) NULL,
  [brand] NVARCHAR(120) NULL,
  [minimum_sale_quantity] DECIMAL(14,4) NOT NULL CONSTRAINT [products_minimum_sale_quantity_df] DEFAULT 0,
  [weight] DECIMAL(14,4) NOT NULL CONSTRAINT [products_weight_df] DEFAULT 0,
  [ncm] NVARCHAR(20) NULL,
  [ipi_percent] DECIMAL(7,4) NOT NULL CONSTRAINT [products_ipi_percent_df] DEFAULT 0,
  [has_st] BIT NOT NULL CONSTRAINT [products_has_st_df] DEFAULT 0,
  [invoice_origin] NVARCHAR(32) NULL;
