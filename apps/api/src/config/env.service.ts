import { Injectable } from "@nestjs/common";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
    HYPERSALES_DB_PATH: z.string().optional(),
    HYPERSALES_SESSION_COOKIE: z.string().min(1).default("hypersales_session"),
    HYPERSALES_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).default(43_200),
    HYPERSALES_COOKIE_SECURE: booleanFromEnv,
    HYPERSALES_COOKIE_SAMESITE: z.enum(["Lax", "Strict", "None"]).default("Lax"),
    HYPERSALES_PUBLIC_URL: z.url().default("http://localhost:8000"),
    HYPERSALES_ALLOWED_ORIGINS: z.string().default(""),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
    HYPERSALES_REPORT_TIMEZONE: z.string().min(1).default("America/Sao_Paulo"),
    HYPERSALES_WHATSAPP_TOKEN: z.string().default(""),
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
  });

function repositoryRoot(): string {
  const cwd = process.cwd();
  return existsSync(resolve(cwd, "apps", "web")) ? cwd : resolve(cwd, "../..");
}

@Injectable()
export class EnvService {
  private readonly values = environmentSchema.parse(process.env);

  readonly nodeEnv = this.values.NODE_ENV;
  readonly host = this.values.HOST;
  readonly port = this.values.PORT;
  readonly databasePath = resolve(
    this.values.HYPERSALES_DB_PATH ?? resolve(repositoryRoot(), "database", "hypersales.sqlite3"),
  );
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
  readonly evolutionApiUrl = new URL(this.values.EVOLUTION_API_URL);
  readonly evolutionApiKey = this.values.EVOLUTION_API_KEY;
  readonly bootstrapAdminName = this.values.HYPERSALES_BOOTSTRAP_ADMIN_NAME;
  readonly bootstrapAdminEmail = this.values.HYPERSALES_BOOTSTRAP_ADMIN_EMAIL;
  readonly bootstrapAdminPassword = this.values.HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD;
}
