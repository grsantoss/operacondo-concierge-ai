/**
 * Portal do Admin Master (/admin): clientes, planos e faturas de todos os clientes.
 * Conecta como `oc_admin`, que vê tudo pela política RLS `plataforma` (não por BYPASSRLS).
 * Cobrança de verdade (Stripe) é a Fase 6: aqui só leitura de faturas e troca de plano no espelho.
 */
import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Fatura, FaturaStatus } from "@/data/faturas";
import type { Plano } from "@/data/planos";
import type { Tenant } from "@/data/tenants";
import { lerContexto } from "@/server/auth/contexto";
import { dbAdmin, schema as s } from "@/server/db";

async function exigirAdmin() {
  const c = await lerContexto();
  if (!c) throw new Error("Sessão expirada. Entre de novo.");
  if (!c.admin) throw new Error("Acesso restrito ao Admin Master.");
  return c;
}

const soDigitos = (v: string) => v.replace(/\D/g, "");
const formatarCnpj = (v: string | null) =>
  v?.length === 14
    ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : (v ?? "");
const METODO = { cartao: "Cartão", boleto: "Boleto", pix: "Pix" } as const;
const dia = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function erroUnico(err: unknown): never {
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = e.code ?? e.cause?.code;
  const constraint = e.constraint ?? e.cause?.constraint ?? "";
  if (code === "23505" && constraint.includes("cnpj"))
    throw new Error("Já existe um cliente com este CNPJ.");
  if (code === "23505" && constraint.includes("email"))
    throw new Error("Já existe um usuário com este e-mail.");
  throw err;
}

export const listarPlanos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Plano[]> => {
    await exigirAdmin();
    const rows = await dbAdmin()
      .select()
      .from(s.planos)
      .where(eq(s.planos.ativo, true))
      .orderBy(s.planos.precoMensal);
    return rows.map((p) => ({
      id: p.id,
      nome: p.nome,
      precoMensal: Number(p.precoMensal),
      condominios: p.limiteCondominios,
      moradores: p.limiteMoradores,
      documentos: p.limiteDocumentos,
      respostasIaMes: p.limiteRespostasIaMes,
      usaConselheiro: p.usaConselheiro,
      vendavel: p.vendavel,
    }));
  },
);

export const listarClientes = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tenant[]> => {
    await exigirAdmin();
    const db = dbAdmin();
    // Assinatura mais recente de cada cliente.
    const { rows } = await db.execute<{
      id: string;
      razao_social: string;
      nome_fantasia: string;
      cnpj: string | null;
      email: string | null;
      telefone: string | null;
      cidade: string | null;
      uf: string | null;
      responsavel: string | null;
      status: Tenant["status"];
      criado_em: string;
      stripe_customer_id: string | null;
      plano_id: string | null;
      assinatura_status: string | null;
      stripe_subscription_id: string | null;
      intervalo: "mensal" | "anual" | null;
      trial_fim: string | null;
      preco_mensal: string | null;
      condominios: string;
      moradores: string;
      documentos: string;
      respostas_ia: string;
    }>(sql`
      select t.*, a.plano_id, a.status as assinatura_status, a.stripe_subscription_id,
             a.intervalo, a.trial_fim, p.preco_mensal,
             u.condominios, u.moradores, u.documentos, u.respostas_ia
        from tenants t
        left join lateral (
          select * from assinaturas x where x.tenant_id = t.id order by x.criado_em desc limit 1
        ) a on true
        left join planos p on p.id = a.plano_id
        left join uso_mensal u on u.tenant_id = t.id
       where t.excluido_em is null
       order by t.nome_fantasia`);
    const membros = await db
      .select({
        tenantId: s.membros.tenantId,
        nome: s.user.name,
        email: s.user.email,
        papel: s.membros.papel,
      })
      .from(s.membros)
      .innerJoin(s.user, eq(s.user.id, s.membros.userId))
      .orderBy(s.user.name);
    return rows.map((t) => ({
      id: t.id,
      razaoSocial: t.razao_social,
      nomeFantasia: t.nome_fantasia,
      cnpj: formatarCnpj(t.cnpj),
      email: t.email ?? "",
      telefone: t.telefone ?? "",
      cidade: t.cidade ?? "",
      uf: t.uf ?? "",
      responsavel: t.responsavel ?? "",
      plano: t.plano_id ?? "",
      status: t.status,
      assinaturaStatus: t.assinatura_status,
      trialFim: dia(t.trial_fim),
      createdAt: dia(t.criado_em),
      // MRR só de assinatura paga e em dia; anual = 10 × mensal, dividido em 12 meses.
      mrr:
        t.assinatura_status === "active" && t.preco_mensal
          ? Number(t.preco_mensal) * (t.intervalo === "anual" ? 10 / 12 : 1)
          : 0,
      stripeCustomerId: t.stripe_customer_id ?? "",
      stripeSubscriptionId: t.stripe_subscription_id ?? "",
      uso: {
        condominios: Number(t.condominios ?? 0),
        moradores: Number(t.moradores ?? 0),
        documentos: Number(t.documentos ?? 0),
        respostasIa: Number(t.respostas_ia ?? 0),
      },
      membros: membros
        .filter((m) => m.tenantId === t.id)
        .map(({ nome, email, papel }) => ({ nome, email, papel })),
    }));
  },
);

/** Status do Stripe → o que a tela mostra. "Vencida" = open com vencimento passado. */
export function statusFatura(
  stripe: string,
  estornado: number,
  vencimento: string,
  hoje: string,
): FaturaStatus {
  if (estornado > 0) return "refunded";
  if (stripe === "paid") return "paid";
  if (stripe === "open" && vencimento && vencimento < hoje) return "past_due";
  if (stripe === "open" || stripe === "draft") return "open";
  return "void";
}

export const listarFaturas = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fatura[]> => {
    await exigirAdmin();
    const rows = await dbAdmin().select().from(s.faturas).orderBy(desc(s.faturas.criadoEm));
    const hoje = dia(new Date());
    return rows.map((f) => {
      const vencimento = f.vencimento ?? "";
      const status = statusFatura(f.status, Number(f.valorEstornado), vencimento, hoje);
      return {
        id: f.id,
        tenantId: f.tenantId,
        numero: f.numero ?? "",
        valor: Number(f.valorTotal),
        status,
        periodo: vencimento.slice(0, 7),
        emissao: dia(f.criadoEm),
        vencimento,
        stripeInvoiceId: f.stripeInvoiceId ?? "",
        metodo: f.metodoPagamento ? METODO[f.metodoPagamento] : "",
        urlFatura: f.urlFatura ?? "",
      };
    });
  },
);

const Dados = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social."),
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia."),
  cnpj: z
    .string()
    .transform(soDigitos)
    .refine((v) => v === "" || v.length === 14, "CNPJ deve ter 14 dígitos."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone: z.string().trim().max(30),
  cidade: z.string().trim().max(80),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "UF com 2 letras."),
  responsavel: z.string().trim().min(2, "Informe o responsável."),
});

/**
 * Cria o cliente em trial de 7 dias (limites do plano interno `trial`), a assinatura no plano
 * escolhido e o acesso do síndico com senha temporária (devolvida uma única vez).
 * ponytail: sem Stripe ainda; na Fase 6 o Customer/Subscription nascem aqui (ou pelo Checkout).
 */
export const criarCliente = createServerFn({ method: "POST" })
  .inputValidator(Dados.extend({ planoId: z.string().min(1) }))
  .handler(async ({ data: { planoId, ...d } }) => {
    await exigirAdmin();
    const senha = `Oc-${randomBytes(9).toString("base64url")}`;
    const hash = await hashPassword(senha);
    try {
      const id = await dbAdmin().transaction(async (tx) => {
        const [plano] = await tx
          .select({ id: s.planos.id })
          .from(s.planos)
          .where(eq(s.planos.id, planoId));
        if (!plano) throw new Error("Plano não encontrado.");
        const [t] = await tx
          .insert(s.tenants)
          .values({ ...d, cnpj: d.cnpj || null, status: "trial" })
          .returning({ id: s.tenants.id });
        await tx.insert(s.assinaturas).values({
          tenantId: t.id,
          planoId,
          status: "trialing",
          formaCobranca: "cartao",
          trialFim: new Date(Date.now() + 7 * 864e5),
        });
        const userId = randomUUID();
        await tx
          .insert(s.user)
          .values({ id: userId, name: d.responsavel, email: d.email, emailVerified: true });
        await tx.insert(s.account).values({
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hash,
        });
        await tx.insert(s.membros).values({ tenantId: t.id, userId, papel: "sindico" });
        return t.id;
      });
      return { id, email: d.email, senha };
    } catch (err) {
      erroUnico(err);
    }
  });

export const atualizarCliente = createServerFn({ method: "POST" })
  .inputValidator(Dados.extend({ id: z.string().uuid() }))
  .handler(async ({ data: { id, ...d } }) => {
    await exigirAdmin();
    try {
      await dbAdmin()
        .update(s.tenants)
        .set({ ...d, cnpj: d.cnpj || null })
        .where(eq(s.tenants.id, id));
    } catch (err) {
      erroUnico(err);
    }
  });

/** ponytail: troca só no espelho; com o Stripe (Fase 6) vira update da subscription com proration. */
export const trocarPlano = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), planoId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await exigirAdmin();
    await dbAdmin().transaction(async (tx) => {
      const [p] = await tx
        .select({ vendavel: s.planos.vendavel })
        .from(s.planos)
        .where(eq(s.planos.id, data.planoId));
      if (!p?.vendavel) throw new Error("Plano não disponível.");
      const [a] = await tx
        .select({ id: s.assinaturas.id })
        .from(s.assinaturas)
        .where(eq(s.assinaturas.tenantId, data.id))
        .orderBy(desc(s.assinaturas.criadoEm))
        .limit(1);
      if (!a) throw new Error("Cliente sem assinatura.");
      await tx
        .update(s.assinaturas)
        .set({ planoId: data.planoId, atualizadoEm: new Date() })
        .where(eq(s.assinaturas.id, a.id));
    });
  });

const limite = z.number().int().min(0).max(10_000_000);

/** Limites dos planos (inclusive o trial). Preço não: o valor cobrado é o do Stripe. */
export const atualizarLimitesPlano = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      condominios: limite,
      moradores: limite,
      documentos: limite,
      respostasIaMes: limite,
    }),
  )
  .handler(async ({ data: { id, ...l } }) => {
    await exigirAdmin();
    await dbAdmin()
      .update(s.planos)
      .set({
        limiteCondominios: l.condominios,
        limiteMoradores: l.moradores,
        limiteDocumentos: l.documentos,
        limiteRespostasIaMes: l.respostasIaMes,
      })
      .where(eq(s.planos.id, id));
  });
