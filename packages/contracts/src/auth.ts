import { z } from "zod";

export const roleSchema = z.enum(["admin", "seller"]);
export type Role = z.infer<typeof roleSchema>;

export const publicUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string(),
  communication_email: z.string().nullable().optional(),
  whatsapp_phone: z.string().nullable().optional(),
  role: roleSchema,
  tenant_id: z.number().int().positive(),
  tenant_name: z.string().nullable().optional(),
  is_super_admin: z.boolean(),
  is_dev: z.boolean(),
  active: z.boolean(),
  must_change_password: z.boolean(),
  password_updated_at: z.string().nullable().optional(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const loginRequestSchema = z
  .object({
    username: z.string().trim().min(1).max(254).optional(),
    email: z.string().trim().min(1).max(254).optional(),
    password: z.string().min(1).max(1024),
  })
  .strict()
  .refine((value) => Boolean(value.username || value.email), {
    message: "Informe o usuario.",
    path: ["username"],
  });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionResponseSchema = z.object({ user: publicUserSchema });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const changePasswordRequestSchema = z.object({
  current_password: z.string().max(1024).optional().default(""),
  new_password: z
    .string()
    .min(12, "A nova senha precisa ter pelo menos 12 caracteres.")
    .max(1024),
}).strict();
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const changePasswordResponseSchema = z.object({
  message: z.string(),
  user: publicUserSchema,
});
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;

export const logoutResponseSchema = z.object({ ok: z.literal(true) });
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
