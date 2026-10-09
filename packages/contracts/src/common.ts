import { z } from "zod";

export const apiErrorSchema = z.object({ error: z.string() });
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("hipersales-api"),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
