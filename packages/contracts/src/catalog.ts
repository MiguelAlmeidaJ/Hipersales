import { z } from "zod";

const activeSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);

export const companyMutationSchema = z.object({
  name: z.string().trim().min(1, "Informe name.").max(180),
  legal_name: z.string().trim().max(240).nullable().optional(),
  trade_name: z.string().trim().max(180).nullable().optional(),
  cnpj: z.string().trim().max(180).nullable().optional(),
  state_registration: z.string().trim().max(180).nullable().optional(),
  tax_regime: z.string().trim().max(180).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  address_number: z.string().trim().max(180).nullable().optional(),
  address_complement: z.string().trim().max(180).nullable().optional(),
  district: z.string().trim().max(180).nullable().optional(),
  city: z.string().trim().max(180).nullable().optional(),
  state: z.string().trim().max(180).nullable().optional(),
  postal_code: z.string().trim().max(180).nullable().optional(),
  phone: z.string().trim().max(180).nullable().optional(),
  email: z.string().trim().max(180).nullable().optional(),
  website: z.string().trim().max(180).nullable().optional(),
  lead_time_days: z.coerce.number().int().min(0).max(3650).optional().default(0),
  active: activeSchema.optional().default(true),
}).strict();

export const productMutationSchema = z.object({
  company_id: z.coerce.number().int().positive("company_id invalido."),
  code: z.string().trim().min(1, "Informe code.").max(100),
  name: z.string().trim().min(1, "Informe name.").max(240),
  product_group: z.string().trim().max(120).nullable().optional(),
  subgroup: z.string().trim().max(160).nullable().optional(),
  unit: z.string().trim().min(1).max(24).optional().default("UN"),
  brand: z.string().trim().max(120).nullable().optional(),
  minimum_sale_quantity: z.coerce.number().finite().nonnegative("Quantidade minima invalida.").optional().default(0),
  weight: z.coerce.number().finite().nonnegative("Peso invalido.").optional().default(0),
  ncm: z.string().trim().max(20).nullable().optional(),
  ipi_percent: z.coerce.number().finite().nonnegative("IPI invalido.").optional().default(0),
  has_st: activeSchema.optional().default(false),
  invoice_origin: z.string().trim().max(32).nullable().optional(),
  price: z.coerce.number().finite().nonnegative("Preco invalido.").optional().default(0),
  active: activeSchema.optional().default(true),
}).strict();

export const productImportSchema = z.object({
  rows: z.array(z.unknown()).max(10_000),
}).strict();

export type CompanyMutation = z.infer<typeof companyMutationSchema>;
export type ProductMutation = z.infer<typeof productMutationSchema>;
export type ProductImport = z.infer<typeof productImportSchema>;
