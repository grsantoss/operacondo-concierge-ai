/**
 * Autoatendimento: planos públicos, cadastro do cliente e Stripe Checkout com trial de 7 dias
 * (cartão exigido). O Stripe é a fonte da verdade: a assinatura só entra no banco pelo espelho
 * (`billing/sync.ts`), aqui ou pelo webhook.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { exigirCliente } from "@/server/auth/contexto";
import { APP, lookupKey } from "@/server/billing/catalogo";
import { assinaturaAtual, usoMensal, type Limites, type Uso } from "@/server/billing/limites";
import { stripe, stripeConfigurado } from "@/server/billing/stripe";
import { concluirCheckout } from "@/server/billing/sync";
import { trialJaUsado } from "@/server/billing/trial";
import { erroUnico, inserirCliente } from "@/server/clientes";
import { db, dbAdmin, schema as s, withTenant } from "@/server/db";

export const TRIAL_DIAS = 7;

export interface PlanoPublico {
  id: string;
  nome: string;
  precoMensal: number;
  condominiosInclusos: number;
  limiteCondominios: number;
  precoCondominioAdicional: number | null;
  moradores: number;
  documentos: number;
  respostasIaMes: number;
  usaConselheiro: boolean;
}

export const listarPlanosPublicos = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanoPublico[]> => {
    const rows = await db()
      .select()
      .from(s.planos)
      .where(and(eq(s.planos.vendavel, true), eq(s.planos.ativo, true)))
      .orderBy(asc(s.planos.precoMensal));
    return rows.map((p) => ({
      id: p.id,
      nome: p.nome,
      precoMensal: Number(p.precoMensal),
      condominiosInclusos: p.condominiosInclusos,
      limiteCondominios: p.limiteCondominios,
      precoCondominioAdicional:
        p.precoCondominioAdicional == null ? null : Number(p.precoCondominioAdicional),
      moradores: p.limiteMoradores,
      documentos: p.limiteDocumentos,
      respostasIaMes: p.limiteRespostasIaMes,
      usaConselheiro: p.usaConselheiro,
    }));
  },
);

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** CNPJ com os dois dígitos verificadores válidos (só números). */
export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = [...base].reduce((acc, d, i) => acc + Number(d) * pesos[i]!, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(cnpj.slice(0, 12));
  const d2 = dv(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

const Cadastro = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128),
  razaoSocial: z.string().trim().min(2, "Informe a razão social."),
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia."),
  cnpj: z.string().transform(soDigitos).refine(cnpjValido, "CNPJ inválido."),
  telefone: z.string().trim().min(10, "Informe um telefone com DDD.").max(30),
});

/**
 * Cria o cliente, o acesso do síndico e o vínculo. Ainda sem assinatura: o /app manda para o
 * pagamento até o Checkout terminar. ponytail: rota pública sem limite de tentativas; pôr
 * limite por IP (ou captcha) quando aparecer abuso.
 */
export const criarConta = createServerFn({ method: "POST" })
  .inputValidator(Cadastro)
  .handler(async ({ data: d }) => {
    try {
      await dbAdmin().transaction((tx) =>
        inserirCliente(
          tx,
          {
            razaoSocial: d.razaoSocial,
            nomeFantasia: d.nomeFantasia,
            cnpj: d.cnpj,
            email: d.email,
            telefone: d.telefone,
            responsavel: d.nome,
            status: "trial",
          },
          { nome: d.nome, email: d.email, senha: d.senha },
        ),
      );
      return { ok: true };
    } catch (err) {
      erroUnico(err);
    }
  });

const formatarCnpj = (v: string) =>
  v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function urlBase(): string {
  return (process.env.APP_URL || getRequestUrl().origin).replace(/\/+$/, "");
}

const Escolha = z.object({
  planoId: z.string().min(1),
  intervalo: z.enum(["mensal", "anual"]),
});

/** Abre o Stripe Checkout da assinatura (trial de 7 dias, só cartão). Devolve a URL. */
export const abrirCheckout = createServerFn({ method: "POST" })
  .inputValidator(Escolha)
  .handler(async ({ data }) => {
    const c = await exigirCliente();
    if (c.papel === "conselho") throw new Error("Só o síndico pode contratar o plano.");
    if (!stripeConfigurado())
      throw new Error("Pagamento indisponível no momento. Tente de novo mais tarde.");
    const adm = dbAdmin();
    const [plano] = await adm
      .select()
      .from(s.planos)
      .where(
        and(eq(s.planos.id, data.planoId), eq(s.planos.vendavel, true), eq(s.planos.ativo, true)),
      );
    if (!plano) throw new Error("Plano não disponível.");
    const temAssinatura = await withTenant(c.tenantId, (tx) => tx.$count(s.assinaturas));
    if (temAssinatura) throw new Error("Este cliente já tem uma assinatura.");
    const [t] = await adm.select().from(s.tenants).where(eq(s.tenants.id, c.tenantId));
    if (!t) throw new Error("Cliente não encontrado.");

    const st = stripe();
    let customer = t.stripeCustomerId;
    if (!customer) {
      const novo = await st.customers.create(
        {
          name: t.razaoSocial,
          email: t.email ?? c.email,
          phone: t.telefone ?? undefined,
          metadata: { app: APP, tenant_id: t.id },
          ...(t.cnpj ? { tax_id_data: [{ type: "br_cnpj", value: formatarCnpj(t.cnpj) }] } : {}),
        },
        { idempotencyKey: `concierge-cliente-${t.id}` },
      );
      customer = novo.id;
      await adm.update(s.tenants).set({ stripeCustomerId: customer }).where(eq(s.tenants.id, t.id));
    }

    const precos = await st.prices.list({
      lookup_keys: [lookupKey(plano.id, data.intervalo)],
      active: true,
      limit: 1,
    });
    const preco = precos.data[0];
    if (!preco)
      throw new Error("Preço do plano não encontrado no Stripe (rode bun run stripe:seed).");

    // Antiabuso: CNPJ que já teve trial assina sem os dias grátis (WhatsApp e cartão: no espelho).
    const semTrial = t.cnpj ? await trialJaUsado(t.id, [["cnpj", t.cnpj]]) : false;
    const base = urlBase();
    const sessao = await st.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: t.id,
      line_items: [{ price: preco.id, quantity: 1 }],
      payment_method_collection: "always",
      locale: "pt-BR",
      metadata: { app: APP, tenant_id: t.id },
      subscription_data: {
        metadata: { app: APP, tenant_id: t.id },
        ...(semTrial
          ? {}
          : {
              trial_period_days: TRIAL_DIAS,
              trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
            }),
      },
      success_url: `${base}/assinar?sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/assinar?plano=${plano.id}&intervalo=${data.intervalo}`,
    });
    if (!sessao.url) throw new Error("O Stripe não devolveu o endereço do pagamento.");
    return { url: sessao.url, semTrial };
  });

/** Volta do Checkout: espelha na hora (sem esperar o webhook) para o /app já abrir. */
export const confirmarCheckout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessao: z.string().startsWith("cs_") }))
  .handler(async ({ data }) => {
    const c = await exigirCliente();
    const st = stripe();
    const sessao = await st.checkout.sessions.retrieve(data.sessao);
    if (sessao.client_reference_id !== c.tenantId) throw new Error("Pagamento de outro cliente.");
    if (sessao.status !== "complete") return { concluido: false };
    await concluirCheckout(sessao.id, st);
    return { concluido: true };
  });

export interface FaturaResumo {
  id: string;
  numero: string | null;
  status: string;
  vencida: boolean;
  valorTotal: number;
  vencimento: string | null;
  pagoEm: string | null;
  urlFatura: string | null;
  urlPdf: string | null;
}

export interface MeuPlano {
  plano: string;
  status: string;
  intervalo: "mensal" | "anual";
  trialFim: string | null;
  periodoFim: string | null;
  cancelaNoFim: boolean;
  /** Estimativa a partir da tabela de planos; o cobrado é o do Stripe. */
  proximaCobranca: number | null;
  limites: Limites;
  uso: Uso;
  faturas: FaturaResumo[];
  podeGerenciar: boolean;
}

/** Aba "Plano e cobrança": plano, uso × limites, próxima cobrança e histórico (do espelho). */
export const meuPlano = createServerFn({ method: "GET" }).handler(
  async (): Promise<MeuPlano | null> => {
    const c = await exigirCliente();
    return withTenant(c.tenantId, async (tx) => {
      const atual = await assinaturaAtual(tx);
      if (!atual) return null;
      const { assinatura: a, plano, limites } = atual;
      const uso = await usoMensal(tx);
      const faturas = await tx
        .select()
        .from(s.faturas)
        .orderBy(sql`${s.faturas.vencimento} desc nulls first`, desc(s.faturas.criadoEm))
        .limit(12);
      const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const adicionais = Math.max(0, a.quantidadeCondominios - plano.condominiosInclusos);
      const mensal =
        Number(plano.precoMensal) + adicionais * Number(plano.precoCondominioAdicional ?? 0);
      const encerrada = a.status === "canceled" || a.status === "incomplete_expired";
      return {
        plano: plano.nome,
        status: a.status,
        intervalo: a.intervalo,
        trialFim: a.trialFim?.toISOString() ?? null,
        periodoFim: a.periodoFim?.toISOString() ?? null,
        cancelaNoFim: a.cancelaNoFim,
        proximaCobranca:
          encerrada || a.cancelaNoFim ? null : a.intervalo === "anual" ? mensal * 10 : mensal,
        limites,
        uso,
        faturas: faturas.map((f) => ({
          id: f.id,
          numero: f.numero,
          status: f.status,
          vencida: f.status === "open" && !!f.vencimento && f.vencimento < hoje,
          valorTotal: Number(f.valorTotal),
          vencimento: f.vencimento,
          pagoEm: f.pagoEm?.toISOString() ?? null,
          urlFatura: f.urlFatura,
          urlPdf: f.urlPdf,
        })),
        podeGerenciar: c.papel !== "conselho",
      };
    });
  },
);

/** Sessão do Customer Portal do Stripe (cartão, faturas, cancelamento). Devolve a URL. */
export const abrirPortal = createServerFn({ method: "POST" }).handler(async () => {
  const c = await exigirCliente();
  if (c.papel === "conselho") throw new Error("Só o síndico pode gerenciar o pagamento.");
  if (!stripeConfigurado())
    throw new Error("Pagamento indisponível no momento. Tente de novo mais tarde.");
  const [t] = await dbAdmin()
    .select({ customer: s.tenants.stripeCustomerId })
    .from(s.tenants)
    .where(eq(s.tenants.id, c.tenantId));
  if (!t?.customer) throw new Error("Este cliente ainda não tem cadastro de pagamento.");
  const sessao = await stripe().billingPortal.sessions.create({
    customer: t.customer,
    locale: "pt-BR",
    return_url: `${urlBase()}/app/configuracoes?aba=plano`,
  });
  return { url: sessao.url };
});
