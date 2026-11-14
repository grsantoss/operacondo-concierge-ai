import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export { schema };
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const conexoes = new Map<string, Db>();

function conectar(variavel: "DATABASE_URL" | "DATABASE_URL_ADMIN"): Db {
  let db = conexoes.get(variavel);
  if (!db) {
    const url = process.env[variavel];
    if (!url) throw new Error(`${variavel} não definida (veja .env.example)`);
    db = drizzle(new pg.Pool({ connectionString: url, max: 10 }), { schema });
    conexoes.set(variavel, db);
  }
  return db;
}

/**
 * Conexão da aplicação (oc_app). Tabelas de cliente só devolvem linhas dentro de `withTenant`;
 * fora dele a RLS não encontra cliente e não devolve nada. Use direto só para as tabelas sem
 * cliente (Better Auth, planos).
 */
export const db = (): Db => conectar("DATABASE_URL");

/** Conexão da plataforma (oc_admin): vê todos os clientes. Só portal /admin, worker e seed. */
export const dbAdmin = (): Db => conectar("DATABASE_URL_ADMIN");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roda `fn` numa transação em que a RLS enxerga só o cliente `tenantId`. */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error("tenant_id inválido");
  return db().transaction(async (tx) => {
    // set_config(..., true) = SET LOCAL: vale só até o fim desta transação.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
