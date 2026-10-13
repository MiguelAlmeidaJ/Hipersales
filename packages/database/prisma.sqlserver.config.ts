import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../.env") });

// Configuracao separada: nao altera o Prisma PostgreSQL ainda usado pela API.
export default defineConfig({
  schema: "prisma/schema.sqlserver.prisma",
  migrations: { path: "prisma/migrations-sqlserver" },
  datasource: {
    url: process.env.SQLSERVER_DATABASE_URL ?? "",
  },
});
