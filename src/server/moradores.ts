/**
 * Moradores no servidor: o que `src/lib/moradores.functions.ts` usa dentro dos handlers. Fica em
 * `src/server` porque exportado de lá iria para o navegador junto com o banco.
 */
import { and, eq } from "drizzle-orm";
import type { Endereco } from "@/data/moradores";
import { type Tx, schema as s } from "@/server/db";

/** Acha ou cria a unidade do endereço (a unicidade é do banco). Sem `vagas`, mantém as atuais. */
export async function unidadeDo(
  tx: Tx,
  tenantId: string,
  i: { condominioId: string; endereco: Endereco; vagas?: number },
): Promise<string> {
  const e = i.endereco;
  const chave =
    e.tipo === "vertical"
      ? { bloco: e.bloco, apto: e.apto, quadra: null, casa: null }
      : { bloco: null, apto: null, quadra: e.quadra, casa: e.casa };
  const [u] = await tx
    .insert(s.unidades)
    .values({
      tenantId,
      condominioId: i.condominioId,
      ...chave,
      andar: e.tipo === "vertical" ? e.andar : null,
      vagas: i.vagas ?? 0,
    })
    .onConflictDoUpdate({
      target: [
        s.unidades.condominioId,
        s.unidades.bloco,
        s.unidades.apto,
        s.unidades.quadra,
        s.unidades.casa,
      ],
      set: {
        ...(i.vagas == null ? {} : { vagas: i.vagas }),
        andar: e.tipo === "vertical" ? e.andar : null,
      },
    })
    .returning({ id: s.unidades.id });
  return u.id;
}

/** Aprovar ou recusar um cadastro pendente (#28); chamado por `decidirCadastro`. */
export async function decidirCadastroTx(
  tx: Tx,
  tenantId: string,
  data: { id: string; decisao: "aprovar" | "recusar"; endereco?: Endereco },
) {
  const [m] = await tx
    .select()
    .from(s.moradores)
    .where(and(eq(s.moradores.id, data.id), eq(s.moradores.cadastro, "pendente")))
    .for("update");
  if (!m) throw new Error("Cadastro não encontrado ou já decidido.");
  if (data.decisao === "recusar") {
    await tx.update(s.moradores).set({ cadastro: "recusado" }).where(eq(s.moradores.id, m.id));
    return;
  }
  const unidadeId = data.endereco
    ? await unidadeDo(tx, tenantId, { condominioId: m.condominioId, endereco: data.endereco })
    : m.unidadeId;
  if (!unidadeId) throw new Error("Informe a unidade para aprovar.");
  await tx
    .update(s.moradores)
    .set({ cadastro: "aprovado", unidadeId })
    .where(eq(s.moradores.id, m.id));
}
