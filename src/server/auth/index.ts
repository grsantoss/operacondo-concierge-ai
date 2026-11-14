import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db, schema } from "../db";

export const auth = betterAuth({
  // Tabelas do Better Auth não têm cliente nem RLS; a conexão oc_app basta.
  database: drizzleAdapter(db(), {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // ponytail: sem cadastro público até o autoatendimento (/cadastro, Fase 6); usuários vêm do seed/admin.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
  plugins: [tanstackStartCookies()],
});
