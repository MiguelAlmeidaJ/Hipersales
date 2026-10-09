import { z } from "zod";

const activeSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);

export const companyMutationSchema = z.object({
  name: z.string().trim().min(1, "Informe name.").max(180),
  legal_name: z.string().trim().max(240).nullable().optional(),
  active: activeSchema.optional().default(true),
}).strict();

export const productMutationSchema = z.object({
  company_id: z.coerce.number().int().positive("company_id invalido."),
  code: z.string().trim().min(1, "Informe code.").max(100),
  name: z.string().trim().min(1, "Informe name.").max(240),
  unit: z.string().trim().min(1).max(24).optional().default("UN"),
  price: z.coerce.number().finite().nonnegative("Preco invalido.").optional().default(0),
  active: activeSchema.optional().default(true),
}).strict();

export const productImportSchema = z.object({
  rows: z.array(z.unknown()).max(10_000),
}).strict();

export type CompanyMutation = z.infer<typeof companyMutationSchema>;
export type ProductMutation = z.infer<typeof productMutationSchema>;
export type ProductImport = z.infer<typeof productImportSchema>;
