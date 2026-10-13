import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL precisa estar configurada para executar comandos do Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
