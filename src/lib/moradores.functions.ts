/**
 * Moradores, unidades e condomínios no banco. O cliente vem sempre da sessão (exigirCliente) e
 * todo acesso passa por withTenant, então a RLS garante o isolamento.
 */
import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Condominio, Morador, Pendente, Status } from "@/data/moradores";
import { formatarTelefone, paraE164 } from "@/lib/telefone";
import { exigirCliente } from "@/server/auth/contexto";
import { exigirLimite } from "@/server/billing/limites";
import { type Tx, schema as s, withTenant } from "@/server/db";
import { decidirCadastroTx, unidadeDo } from "@/server/moradores";

/* ------------------------------------------------------------ conversões */

const STATUS_DB = {
  Residente: "residente",
  Locatário: "locatario",
  Proprietário: "proprietario",
  Inativo: "inativo",
} as const;
const STATUS_TELA = {
  residente: "Residente",
  locatario: "Locatário",
  proprietario: "Proprietário",
  inativo: "Inativo",
} as const satisfies Record<string, Status>;

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "Mar 2019" → "2019-03-01". */
function desdeParaData(v?: string): string | null {
  const m = v?.trim().match(/^(\w{3})\w*\s+(\d{4})$/);
  const i = m ? MESES.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) : -1;
  return m && i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, "0")}-01` : null;
}
function dataParaDesde(d: string | null): string | undefined {
  if (!d) return undefined;
  const [ano, mes] = d.split("-");
  return `${MESES[Number(mes) - 1]} ${ano}`;
}

/** Prefixo dos ids de unidade vaga na lista (não é morador). */
const VAGO = "vago:";

function hashCpf(digitos: string): string {
  const pepper = process.env.CPF_PEPPER;
  if (!pepper) throw new Error("CPF_PEPPER não definida");
  return createHmac("sha256", pepper).update(digitos).digest("hex");
}

/* ------------------------------------------------------------ validação */

const Endereco = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("vertical"),
    bloco: z.string().trim().min(1),
    andar: z.number().int(),
    apto: z.string().trim().min(1),
  }),
  z.object({
    tipo: z.literal("horizontal"),
    quadra: z.string().trim().min(1),
    casa: z.string().trim().min(1),
  }),
]);

const MoradorInput = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  condominioId: z.string().uuid(),
  endereco: Endereco,
  status: z.enum(["Residente", "Locatário", "Proprietário", "Vago"]),
  contato: z.string().optional(),
  email: z.string().trim().optional(),
  /** CPF completo para gravar; valor mascarado ("***…-04") mantém o atual. */
  cpf: z.string().optional(),
  vagas: z.number().int().min(0).default(0),
  pets: z.number().int().min(0).default(0),
  desde: z.string().optional(),
});
type MoradorInput = z.infer<typeof MoradorInput>;

/* ------------------------------------------------------------ leitura */

export const listarCondominios = createServerFn({ method: "GET" }).handler(
  async (): Promise<Condominio[]> => {
    const { tenantId } = await exigirCliente();
    const rows = await withTenant(tenantId, (tx) =>
      tx.select().from(s.condominios).orderBy(s.condominios.nome),
    );
    return rows.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      cidade: [c.cidade, c.uf].filter(Boolean).join(" — "),
      unidades: c.unidadesTotal ?? 0,
    }));
  },
);

/** Moradores (ativos e arquivados) + unidades vagas, no formato das telas. */
export const listarMoradores = createServerFn({ method: "GET" }).handler(
  async (): Promise<Morador[]> => {
    const { tenantId } = await exigirCliente();
    return withTenant(tenantId, async (tx) => {
      const pessoas = await tx
        .select({
          m: s.moradores,
          u: s.unidades,
          fone: sql<string | null>`(select c.phone_e164 from morador_contatos c
          where c.morador_id = ${s.moradores.id} order by c.principal desc limit 1)`,
        })
        .from(s.moradores)
        // Pendentes e recusados ficam em listarPendentes (#28), não na lista de moradores.
        .innerJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
        .where(eq(s.moradores.cadastro, "aprovado"))
        .orderBy(s.moradores.nome);
      const vagas = await tx
        .select()
        .from(s.unidades)
        .where(
          sql`not exists (select 1 from moradores m where m.unidade_id = ${s.unidades.id} and m.desativado_em is null and m.cadastro = 'aprovado')`,
        );

      const endereco = (u: typeof s.unidades.$inferSelect): Morador["endereco"] =>
        u.quadra != null
          ? { tipo: "horizontal", quadra: u.quadra, casa: u.casa ?? "" }
          : { tipo: "vertical", bloco: u.bloco ?? "", andar: u.andar ?? 0, apto: u.apto ?? "" };

      return [
        ...pessoas.map(({ m, u, fone }) => ({
          id: m.id,
          nome: m.nome,
          condominioId: m.condominioId,
          endereco: endereco(u),
          status: m.desativadoEm ? ("Inativo" as const) : STATUS_TELA[m.status],
          vagas: u.vagas,
          pets: m.pets,
          contato: formatarTelefone(fone),
          email: m.email ?? undefined,
          desde: dataParaDesde(m.desde),
          cpf: m.cpfFinal ? `***.***.***-${m.cpfFinal}` : undefined,
          ultimo: "—",
          desativadoEm: m.desativadoEm?.toLocaleDateString("pt-BR"),
        })),
        ...vagas.map((u) => ({
          id: VAGO + u.id,
          nome: "—",
          condominioId: u.condominioId,
          endereco: endereco(u),
          status: "Vago" as const,
          vagas: u.vagas,
          pets: 0,
          contato: "—",
          ultimo: "—",
        })),
      ];
    });
  },
);

/* ------------------------------------------------------------ gravação */

async function gravarContato(tx: Tx, tenantId: string, moradorId: string, i: MoradorInput) {
  const bruto = i.contato?.trim();
  if (!bruto || bruto === "—") return;
  const fone = paraE164(bruto);
  if (!fone) throw new Error(`Telefone inválido: ${bruto}`);
  await tx.delete(s.moradorContatos).where(eq(s.moradorContatos.moradorId, moradorId));
  const usado = await tx
    .select({ id: s.moradorContatos.id })
    .from(s.moradorContatos)
    .where(
      and(
        eq(s.moradorContatos.condominioId, i.condominioId),
        eq(s.moradorContatos.phoneE164, fone),
      ),
    );
  if (usado.length)
    throw new Error(`O telefone ${formatarTelefone(fone)} já é de outro morador deste condomínio.`);
  await tx
    .insert(s.moradorContatos)
    .values({ tenantId, moradorId, condominioId: i.condominioId, phoneE164: fone });
}

function camposMorador(i: MoradorInput) {
  const cpf = (i.cpf ?? "").replace(/\D/g, "");
  return {
    nome: i.nome,
    condominioId: i.condominioId,
    status: STATUS_DB[i.status === "Vago" ? "Residente" : i.status],
    email: i.email || null,
    pets: i.pets,
    desde: desdeParaData(i.desde),
    // Só grava CPF quando vier completo; valor mascarado mantém o que já existe.
    ...(cpf.length === 11 ? { cpfHash: hashCpf(cpf), cpfFinal: cpf.slice(-2) } : {}),
  };
}

/** Cria morador (ou só a unidade, se status = Vago). Cadastro feito pelo síndico já é aprovado. */
async function criar(tx: Tx, tenantId: string, i: MoradorInput) {
  const unidadeId = await unidadeDo(tx, tenantId, i);
  if (i.status === "Vago") return;
  const [m] = await tx
    .insert(s.moradores)
    .values({ tenantId, unidadeId, cadastro: "aprovado", ...camposMorador(i) })
    .returning({ id: s.moradores.id });
  await gravarContato(tx, tenantId, m.id, i);
}

export const criarMoradores = createServerFn({ method: "POST" })
  .inputValidator(z.array(MoradorInput).min(1).max(5000))
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, async (tx) => {
      await exigirLimite(tx, "moradores", data.length);
      for (const [n, i] of data.entries()) {
        try {
          await criar(tx, tenantId, i);
        } catch (e) {
          throw new Error(
            data.length > 1
              ? `Linha ${n + 1} (${i.nome}): ${(e as Error).message}`
              : (e as Error).message,
          );
        }
      }
    });
    return { criados: data.length };
  });

export const atualizarMorador = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), dados: MoradorInput }))
  .handler(async ({ data: { id, dados } }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, async (tx) => {
      if (id.startsWith(VAGO)) {
        // unidade vaga recebendo morador
        await exigirLimite(tx, "moradores");
        return criar(tx, tenantId, dados);
      }
      const unidadeId = await unidadeDo(tx, tenantId, dados);
      const r = await tx
        .update(s.moradores)
        .set({ unidadeId, ...camposMorador(dados) })
        .where(eq(s.moradores.id, z.string().uuid().parse(id)))
        .returning({ id: s.moradores.id });
      if (!r.length) throw new Error("Morador não encontrado.");
      await gravarContato(tx, tenantId, id, dados);
    });
  });

const Id = z.object({ id: z.string().uuid() });

export const desativarMorador = createServerFn({ method: "POST" })
  .inputValidator(Id)
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, (tx) =>
      tx.update(s.moradores).set({ desativadoEm: new Date() }).where(eq(s.moradores.id, data.id)),
    );
  });

export const reativarMorador = createServerFn({ method: "POST" })
  .inputValidator(
    Id.extend({ status: z.enum(["Residente", "Locatário", "Proprietário"]).default("Residente") }),
  )
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, async (tx) => {
      await exigirLimite(tx, "moradores");
      await tx
        .update(s.moradores)
        .set({ desativadoEm: null, status: STATUS_DB[data.status] })
        .where(eq(s.moradores.id, data.id));
    });
  });

/** Exclui de vez (LGPD): só moradores já arquivados. */
export const excluirMoradores = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).optional() }))
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, (tx) =>
      tx
        .delete(s.moradores)
        .where(
          and(
            isNotNull(s.moradores.desativadoEm),
            data.ids ? inArray(s.moradores.id, data.ids) : undefined,
          ),
        ),
    );
  });

/* ------------------------------------------------------------ cadastro pelo WhatsApp (#28) */

/** Cadastros feitos pelo agente no 1º contato, esperando o síndico (mais antigos primeiro). */
export const listarPendentes = createServerFn({ method: "GET" }).handler(
  async (): Promise<Pendente[]> => {
    const { tenantId } = await exigirCliente();
    const rows = await withTenant(tenantId, (tx) =>
      tx
        .select({
          m: s.moradores,
          u: s.unidades,
          condominio: s.condominios.nome,
          tipo: s.condominios.tipo,
          fone: sql<string | null>`(select c.phone_e164 from morador_contatos c
          where c.morador_id = ${s.moradores.id} order by c.principal desc limit 1)`,
        })
        .from(s.moradores)
        .innerJoin(s.condominios, eq(s.condominios.id, s.moradores.condominioId))
        .leftJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
        .where(and(eq(s.moradores.cadastro, "pendente"), isNull(s.moradores.desativadoEm)))
        .orderBy(s.moradores.criadoEm),
    );
    return rows.map(({ m, u, condominio, tipo, fone }) => ({
      id: m.id,
      nome: m.nome,
      condominioId: m.condominioId,
      condominio,
      tipo,
      vinculo: STATUS_TELA[m.status],
      unidadeInformada: m.unidadeInformada,
      unidade: u
        ? u.quadra != null
          ? { tipo: "horizontal", quadra: u.quadra, casa: u.casa ?? "" }
          : { tipo: "vertical", bloco: u.bloco ?? "", andar: u.andar ?? 0, apto: u.apto ?? "" }
        : null,
      contato: formatarTelefone(fone),
      criadoEm: m.criadoEm.toISOString(),
    }));
  },
);

/**
 * Aprovar libera demandas próprias, regras de moradores e dados da unidade no agente. Sem unidade
 * ligada (o agente só liga quando a resposta é inequívoca), o síndico informa o endereço aqui.
 * Recusar mantém o número: o agente continua reconhecendo e responde só regras públicas.
 */
const Decisao = z.object({
  id: z.string().uuid(),
  decisao: z.enum(["aprovar", "recusar"]),
  endereco: Endereco.optional(),
});

export const decidirCadastro = createServerFn({ method: "POST" })
  .inputValidator(Decisao)
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, (tx) => decidirCadastroTx(tx, tenantId, data));
  });
