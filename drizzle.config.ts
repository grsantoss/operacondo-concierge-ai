import { defineConfig } from "drizzle-kit";

// Migrations rodam como oc_owner (dono das tabelas). A aplicação nunca usa esta URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATIONS ?? "" },
  strict: true,
});
