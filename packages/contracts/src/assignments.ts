import { z } from "zod";

const positiveId = z.coerce.number().int().positive("Identificador invalido.");

export const legacyCustomerAssignmentRequestSchema = z.object({
  customer_id: positiveId,
  seller_id: positiveId,
}).strict();

export const assignmentRequestSchema = z.object({
  customer_id: positiveId.optional(),
  company_id: positiveId.optional(),
  seller_id: positiveId,
  assigned: z.boolean(),
}).strict();

export type LegacyCustomerAssignmentRequest = z.infer<typeof legacyCustomerAssignmentRequestSchema>;
export type AssignmentRequest = z.infer<typeof assignmentRequestSchema>;
