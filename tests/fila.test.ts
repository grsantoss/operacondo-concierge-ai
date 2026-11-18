/** A fila parada não pode ser reaproveitada (os arquivos de teste dividem o mesmo processo). */
import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { dbAdmin } from "../src/server/db";
import { enfileirarStripe, fila, pararFila } from "../src/server/queue";

test("depois de pararFila, o próximo envio conecta de novo", async () => {
  await fila();
  await pararFila(false);
  const eventId = `evt_fila_${Date.now()}`;
  await enfileirarStripe({ eventId });
  const { rows } = await dbAdmin().execute<{ n: number }>(
    sql`select count(*)::int as n from pgboss.job where singleton_key = ${eventId}`,
  );
  expect(rows[0]!.n).toBe(1);
  await dbAdmin().execute(sql`delete from pgboss.job where singleton_key = ${eventId}`);
});
