import { z } from "zod";

export const settingsSectionSchema = z.enum([
  "customer_funnel",
  "product_funnel",
  "order_statuses",
  "smtp",
  "whatsapp",
  "message_templates",
]);

export const updateSettingsRequestSchema = z.object({
  section: settingsSectionSchema,
  data: z.unknown(),
}).strict();

export type SettingsSection = z.infer<typeof settingsSectionSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
