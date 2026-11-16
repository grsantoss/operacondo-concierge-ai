/**
 * Fornecedores, homologação e documentos (arquivos no S3). Cliente sempre da sessão
 * (exigirCliente) + withTenant.
 */
import { createServerFn } from "@tanstack/react-start";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  CATEGORIAS,
  CRITERIOS_HOMOLOGACAO,
  type Doc,
  type Estado,
  type Supplier,
} from "@/data/fornecedores";
import { formatarTelefone, paraE164 } from "@/lib/telefone";
import { gravarArquivo, linkTemporario, nomeSeguro } from "@/server/arquivos";
import { exigirCliente } from "@/server/auth/contexto";
import { type Tx, schema as s, withTenant } from "@/server/db";

const ESTADO_DB = {
  Homologado: "homologado",
  "Em análise": "em_analise",
  Renovação: "renovacao",
  Inativo: "inativo",
} as const;
const ESTADO_TELA = {
  homologado: "Homologado",
  em_analise: "Em análise",
  renovacao: "Renovação",
  inativo: "Inativo",
} as const satisfies Record<string, Estado>;

const TZ = "America/Sao_Paulo";
/** "2027-03-10" → "10/03/2027". */
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : undefined);

function cnpjTela(digitos: string | null): string {
  const d = digitos ?? "";
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : d;
}

/* ------------------------------------------------------------ leitura */

export const listarFornecedores = createServerFn({ method: "GET" }).handler(
  async (): Promise<Supplier[]> => {
    const { tenantId } = await exigirCliente();
    return withTenant(tenantId, async (tx) => {
      const servicos = sql<number>`(select count(*)::int from demandas d where d.fornecedor_id = ${s.fornecedores.id})`;
      const linhas = await tx
        .select({ f: s.fornecedores, servicos })
        .from(s.fornecedores)
        .orderBy(asc(s.fornecedores.nome));
      const docs = await tx
        .select()
        .from(s.fornecedorDocumentos)
        .orderBy(asc(s.fornecedorDocumentos.criadoEm));
      return Promise.all(
        linhas.map(async ({ f, servicos }) => ({
          id: f.id,
          nome: f.nome,
          categoria: f.categoria ?? "",
          estado: ESTADO_TELA[f.estado],
          rating: f.rating ?? 0,
          ultimos: servicos,
          cnpj: cnpjTela(f.cnpj),
          contato: formatarTelefone(f.contato),
          email: f.email ?? "",
          contatoNome: f.contatoNome ?? undefined,
          observacoes: f.observacoes ?? undefined,
          docs: await Promise.all(
            docs
              .filter((d) => d.fornecedorId === f.id)
              .map(
                async (d): Promise<Doc> => ({
                  name: d.nome,
                  kind: d.tipo,
                  validUntil: dataBr(d.validoAte),
                  uploadedAt: d.criadoEm.toLocaleDateString("pt-BR", { timeZone: TZ }),
                  url: d.storagePath ? await linkTemporario(d.storagePath, d.nome) : undefined,
                }),
              ),
          ),
          homologacao: {
            criteriosOk: f.criteriosOk,
            validoAte: dataBr(f.homologacaoValidaAte),
          },
        })),
      );
    });
  },
);

/* ------------------------------------------------------------ gravação */

const Id = z.object({ id: z.string().uuid() });

async function alterar(id: string, mudar: (tx: Tx, tenantId: string) => Promise<unknown[]>) {
  const { tenantId } = await exigirCliente();
  const r = await withTenant(tenantId, (tx) => mudar(tx, tenantId));
  if (!r.length) throw new Error("Fornecedor não encontrado.");
}

/** CNPJ repetido no mesmo cliente vira mensagem legível. */
function cnpjRepetido(e: unknown): never {
  const err = e as { code?: string; cause?: { code?: string } };
  if ((err.cause?.code ?? err.code) === "23505")
    throw new Error("Já existe um fornecedor com este CNPJ.");
  throw e;
}

const Campos = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  // Listas lidas na hora (import circular com @/data/fornecedores).
  categoria: z
    .string()
    .refine((v) => (CATEGORIAS as readonly string[]).includes(v), "Categoria inválida."),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ precisa ter 14 dígitos."),
  /** Telefone/WhatsApp: guardado em E.164; vazio é permitido. */
  contato: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v || v === "—") return null;
      const e164 = paraE164(v);
      if (!e164) ctx.addIssue({ code: "custom", message: `Telefone inválido: ${v}` });
      return e164;
    }),
  email: z.string().trim(),
  estado: z.enum(["Homologado", "Em análise", "Renovação", "Inativo"]),
  rating: z.number().min(0).max(5),
});

export const criarFornecedor = createServerFn({ method: "POST" })
  .inputValidator(
    Campos.extend({
      contatoNome: z.string().trim().max(80).optional(),
      observacoes: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    const [f] = await withTenant(tenantId, (tx) =>
      tx
        .insert(s.fornecedores)
        .values({
          tenantId,
          ...data,
          estado: ESTADO_DB[data.estado],
          email: data.email || null,
          contatoNome: data.contatoNome || null,
          observacoes: data.observacoes || null,
        })
        .returning({ id: s.fornecedores.id }),
    ).catch(cnpjRepetido);
    return { id: f.id };
  });

export const atualizarFornecedor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), dados: Campos }))
  .handler(({ data: { id, dados } }) =>
    alterar(id, (tx) =>
      tx
        .update(s.fornecedores)
        .set({ ...dados, estado: ESTADO_DB[dados.estado], email: dados.email || null })
        .where(eq(s.fornecedores.id, id))
        .returning({ id: s.fornecedores.id })
        .catch(cnpjRepetido),
    ),
  );

export const alternarCriterio = createServerFn({ method: "POST" })
  .inputValidator(
    Id.extend({
      criterioId: z
        .string()
        .refine((v) => CRITERIOS_HOMOLOGACAO.some((c) => c.id === v), "Critério inválido."),
    }),
  )
  .handler(({ data }) =>
    alterar(data.id, (tx) =>
      tx
        .update(s.fornecedores)
        .set({
          // Liga/desliga na própria linha, sem ler antes (dois cliques seguidos não se atropelam).
          criteriosOk: sql`case when ${data.criterioId} = any(${s.fornecedores.criteriosOk})
            then array_remove(${s.fornecedores.criteriosOk}, ${data.criterioId})
            else array_append(${s.fornecedores.criteriosOk}, ${data.criterioId}) end`,
        })
        .where(eq(s.fornecedores.id, data.id))
        .returning({ id: s.fornecedores.id }),
    ),
  );

/** Homologação vale 12 meses. */
export const homologarFornecedor = createServerFn({ method: "POST" })
  .inputValidator(Id)
  .handler(({ data }) =>
    alterar(data.id, (tx) =>
      tx
        .update(s.fornecedores)
        .set({
          estado: "homologado",
          homologacaoValidaAte: sql`(now() at time zone ${TZ})::date + interval '12 months'`,
        })
        .where(eq(s.fornecedores.id, data.id))
        .returning({ id: s.fornecedores.id }),
    ),
  );

export const arquivarFornecedor = createServerFn({ method: "POST" })
  .inputValidator(Id)
  .handler(({ data }) =>
    alterar(data.id, (tx) =>
      tx
        .update(s.fornecedores)
        .set({ estado: "inativo" })
        .where(eq(s.fornecedores.id, data.id))
        .returning({ id: s.fornecedores.id }),
    ),
  );

const LIMITE_DOC = 20 * 1024 * 1024;
const TIPOS_DOC = ["cnpj", "contrato", "certidao", "apolice", "art", "outro"] as const;

/** FormData: fornecedorId, tipo, validoAte (AAAA-MM-DD, opcional) e arquivo (PDF ou imagem). */
export const enviarDocumentoFornecedor = createServerFn({ method: "POST" })
  .inputValidator((fd: unknown) => {
    if (!(fd instanceof FormData)) throw new Error("Envio inválido.");
    const campos = z
      .object({
        fornecedorId: z.string().uuid(),
        tipo: z.enum(TIPOS_DOC),
        validoAte: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
      })
      .parse({
        fornecedorId: fd.get("fornecedorId"),
        tipo: fd.get("tipo"),
        validoAte: fd.get("validoAte") || null,
      });
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) throw new Error("Escolha um arquivo.");
    if (arquivo.size > LIMITE_DOC) throw new Error(`${arquivo.name}: maior que 20 MB.`);
    const ok = arquivo.type === "application/pdf" || arquivo.type.startsWith("image/");
    if (!ok) throw new Error(`${arquivo.name}: só PDF ou imagem.`);
    return { ...campos, arquivo };
  })
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, async (tx) => {
      const [f] = await tx
        .select({ id: s.fornecedores.id })
        .from(s.fornecedores)
        .where(eq(s.fornecedores.id, data.fornecedorId));
      if (!f) throw new Error("Fornecedor não encontrado.");
      // Fornecedor é do cliente, não de um condomínio: o caminho usa "geral" no lugar dele.
      const caminho = `${tenantId}/geral/fornecedores/${f.id}/${crypto.randomUUID()}-${nomeSeguro(data.arquivo.name)}`;
      await gravarArquivo(
        caminho,
        new Uint8Array(await data.arquivo.arrayBuffer()),
        data.arquivo.type,
      );
      await tx.insert(s.fornecedorDocumentos).values({
        tenantId,
        fornecedorId: f.id,
        nome: data.arquivo.name,
        tipo: data.tipo,
        validoAte: data.validoAte ?? null,
        storagePath: caminho,
      });
    });
  });
