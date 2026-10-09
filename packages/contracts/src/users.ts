import { z } from "zod";
import { publicUserSchema, roleSchema } from "./auth.js";

const optionalPassword = z.string().trim().min(12, "A senha precisa ter pelo menos 12 caracteres.").max(1024).optional();
const activeSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);

export const createUserRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(160),
    email: z.string().trim().min(1, "Informe o usuario.").max(254),
    communication_email: z.string().trim().max(254).optional().default(""),
    whatsapp_phone: z.string().trim().max(32).optional().default(""),
    role: roleSchema,
    active: activeSchema.optional().default(true),
    password: optionalPassword,
    temporary_password: optionalPassword,
  })
  .strict()
  .refine((input) => Boolean(input.password || input.temporary_password), {
    message: "Informe a senha ou a senha temporaria.",
    path: ["temporary_password"],
  });
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    email: z.string().trim().min(1).max(254).optional(),
    communication_email: z.string().trim().max(254).optional(),
    whatsapp_phone: z.string().trim().max(32).optional(),
    role: roleSchema.optional(),
    active: activeSchema.optional(),
    password: optionalPassword,
    temporary_password: optionalPassword,
    must_change_password: z.boolean().optional(),
  })
  .strict();
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const usersResponseSchema = z.object({ users: z.array(publicUserSchema) });
export type UsersResponse = z.infer<typeof usersResponseSchema>;

export const userMutationResponseSchema = z.object({
  id: z.number().int().positive().optional(),
  message: z.string(),
  user: publicUserSchema,
});
export type UserMutationResponse = z.infer<typeof userMutationResponseSchema>;
