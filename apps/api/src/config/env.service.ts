import { Injectable } from "@nestjs/common";
import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3110),
    SQLSERVER_DATABASE_URL: z.string().default(""),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
    HYPERSALES_SESSION_COOKIE: z.string().min(1).default("hypersales_session"),
    HYPERSALES_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).default(43_200),
    HYPERSALES_COOKIE_SECURE: booleanFromEnv,
    HYPERSALES_COOKIE_SAMESITE: z.enum(["Lax", "Strict", "None"]).default("Lax"),
    HYPERSALES_PUBLIC_URL: z.url().default("http://localhost:3110"),
    HYPERSALES_ALLOWED_ORIGINS: z.string().default(""),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
    HYPERSALES_REPORT_TIMEZONE: z.string().min(1).default("America/Sao_Paulo"),
    HYPERSALES_WHATSAPP_TOKEN: z.string().default(""),
    EXPO_PUSH_ACCESS_TOKEN: z.string().default(""),
    SINTEGRA_API_KEY: z.string().default(""),
    EVOLUTION_API_URL: z.url().default("http://127.0.0.1:8081"),
    EVOLUTION_API_KEY: z.string().default(""),
    HYPERSALES_BOOTSTRAP_ADMIN_NAME: z.string().default("Administrador"),
    HYPERSALES_BOOTSTRAP_ADMIN_EMAIL: z.string().default(""),
    HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD: z.string().default(""),
  })
  .superRefine((value, context) => {
    if (value.HYPERSALES_COOKIE_SAMESITE === "None" && !value.HYPERSALES_COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["HYPERSALES_COOKIE_SECURE"],
        message: "SameSite=None exige HYPERSALES_COOKIE_SECURE=true.",
      });
    }
    if (!value.SQLSERVER_DATABASE_URL) {
      context.addIssue({ code: "custom", path: ["SQLSERVER_DATABASE_URL"], message: "SQLSERVER_DATABASE_URL obrigatoria para SQL Server." });
    }
    const databaseUser = value.SQLSERVER_DATABASE_URL
      .match(/(?:^|;)\s*user\s*=\s*(\{[^}]*\}|[^;]*)/i)?.[1]
      ?.replace(/^\{|\}$/g, "")
      .trim();
    if (value.NODE_ENV === "production" && databaseUser?.toLowerCase() === "sa") {
      context.addIssue({ code: "custom", path: ["SQLSERVER_DATABASE_URL"], message: "Producao nao pode usar o login administrativo sa." });
    }
  });

@Injectable()
export class EnvService {
  private readonly values = environmentSchema.parse(process.env);

  readonly nodeEnv = this.values.NODE_ENV;
  readonly host = this.values.HOST;
  readonly port = this.values.PORT;
  readonly databaseUrl = this.values.SQLSERVER_DATABASE_URL;
  readonly databasePoolSize = this.values.DATABASE_POOL_SIZE;
  readonly sessionCookie = this.values.HYPERSALES_SESSION_COOKIE;
  readonly sessionTtlSeconds = this.values.HYPERSALES_SESSION_TTL_SECONDS;
  readonly cookieSecure = this.values.HYPERSALES_COOKIE_SECURE;
  readonly cookieSameSite = this.values.HYPERSALES_COOKIE_SAMESITE.toLowerCase() as
    | "lax"
    | "strict"
    | "none";
  readonly publicUrl = new URL(this.values.HYPERSALES_PUBLIC_URL);
  readonly allowedOrigins = new Set(
    this.values.HYPERSALES_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  readonly trustProxy = this.values.TRUST_PROXY;
  readonly reportTimezone = this.values.HYPERSALES_REPORT_TIMEZONE;
  readonly whatsappInternalToken = this.values.HYPERSALES_WHATSAPP_TOKEN;
  readonly expoPushAccessToken = this.values.EXPO_PUSH_ACCESS_TOKEN;
  readonly sintegraApiKey = this.values.SINTEGRA_API_KEY;
  readonly evolutionApiUrl = new URL(this.values.EVOLUTION_API_URL);
  readonly evolutionApiKey = this.values.EVOLUTION_API_KEY;
  readonly bootstrapAdminName = this.values.HYPERSALES_BOOTSTRAP_ADMIN_NAME;
  readonly bootstrapAdminEmail = this.values.HYPERSALES_BOOTSTRAP_ADMIN_EMAIL;
  readonly bootstrapAdminPassword = this.values.HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD;
}
