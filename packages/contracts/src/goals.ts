import { z } from "zod";

export const goalValueSchema = z.union([z.number(), z.string().max(64), z.null()]);

export const saveGoalsRequestSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    goals: z
      .array(
        z
          .object({
            seller_id: z.number().int().positive(),
            sales_goal: goalValueSchema.optional().default(null),
            new_customers_goal: goalValueSchema.optional().default(null),
            customer_positivation_goal: goalValueSchema.optional().default(null),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();
export type SaveGoalsRequest = z.infer<typeof saveGoalsRequestSchema>;

export interface GoalProgress {
  enabled: boolean;
  goal: number | null;
  realized: number;
  missing: number;
  percent: number;
}

export interface GoalPerformance {
  year: number;
  month: number;
  has_goals: boolean;
  sales: GoalProgress;
  new_customers: GoalProgress;
  customer_positivation: GoalProgress;
  portfolio: { customers: number; attended: number };
}
