/**
 * Cobrança pelo Admin Master (#32): assinatura por cartão (link do Checkout) ou boleto, troca de
 * plano com proration, cobrança avulsa, ações na fatura, cancelamento, NFS-e manual e o card do
 * Stripe (modo, conta, último webhook e Pix). Tudo acontece no Stripe; o banco é atualizado pelo
 * espelho (`billing/sync.ts`), aqui na hora e de novo pelo webhook.
 */
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { exigirAdmin } from "@/server/auth/contexto";
import { APP } from "@/server/billing/catalogo";
import {
  assinaturaBoleto,
  garantirCustomer,
  metodosFatura,
  pixAtivo,
  planoVendavel,
  precoDoPlano,
  sessaoCheckout,
  urlBase,
} from "@/server/billing/checkout";
import { stripe, stripeConfigurado } from "@/server/billing/stripe";
import { sincronizarAssinatura, sincronizarFatura } from "@/server/billing/sync";
import { dbAdmin, schema as s } from "@/server/db";

const Intervalo = z.enum(["mensal", "anual"]);
const Dias = z.number().int().min(1).max(60);

function exigirStripe() {
  if (!stripeConfigurado()) throw new Error("Stripe não configurado (STRIPE_SECRET_KEY).");
  return stripe();
}

/** Assinatura que vale (a mais recente) do cliente. */
async function assinaturaDo(tenantId: string) {
  const [a] = await dbAdmin()
    .select()
    .from(s.assinaturas)
    .where(eq(s.assinaturas.tenantId, tenantId))
    .orderBy(desc(s.assinaturas.criadoEm))
    .limit(1);
  return a ?? null;
}

const ENCERRADA = new Set(["canceled", "incomplete_expired"]);

/**
 * Cartão: devolve o link do Checkout para o admin enviar ao síndico. Boleto: cria a assinatura
 * com faturas enviadas pelo Stripe (`send_invoice`). Trial de 7 dias se o CNPJ ainda não teve.
 */
export const assinarCliente = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      tenantId: z.string().uuid(),
      planoId: z.string().min(1),
      intervalo: Intervalo,
      forma: z.enum(["cartao", "boleto"]),
      diasParaPagar: Dias.default(7),
    }),
  )
  .handler(async ({ data: d }) => {
    await exigirAdmin();
    const st = exigirStripe();
    const atual = await assinaturaDo(d.tenantId);
    if (atual && !ENCERRADA.has(atual.status))
      throw new Error("O cliente já tem uma assinatura ativa.");
    if (d.forma === "cartao") {
      const { url, semTrial } = await sessaoCheckout(
        st,
        d.tenantId,
        d.planoId,
        d.intervalo,
        urlBase(),
      );
      return { link: url, semTrial };
    }
    const sub = await assinaturaBoleto(st, d.tenantId, d.planoId, d.intervalo, d.diasParaPagar);
    const r = await sincronizarAssinatura(sub.id, st);
    if (r?.faturaId) await sincronizarFatura(r.faturaId, st);
    return { link: null, semTrial: sub.status !== "trialing" };
  });

/** Troca de plano no Stripe, com cobrança proporcional; mantém o intervalo e os condomínios. */
export const trocarPlanoStripe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tenantId: z.string().uuid(), planoId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await exigirAdmin();
    const st = exigirStripe();
    const a = await assinaturaDo(data.tenantId);
    if (!a?.stripeSubscriptionId || ENCERRADA.has(a.status))
      throw new Error("O cliente não tem assinatura ativa no Stripe.");
    if (a.planoId === data.planoId) return;
    await planoVendavel(data.planoId);
    const sub = await st.subscriptions.retrieve(a.stripeSubscriptionId);
    const item = sub.items.data.find((i) => i.price.lookup_key?.startsWith("concierge_"));
    if (!item) throw new Error("Item do plano não encontrado na assinatura.");
    await st.subscriptions.update(sub.id, {
      items: [
        {
          id: item.id,
          price: await precoDoPlano(st, data.planoId, a.intervalo),
          quantity: item.quantity ?? 1,
        },
      ],
      proration_behavior: "create_prorations",
    });
    await sincronizarAssinatura(sub.id, st);
  });

/** Cobrança avulsa: fatura com um item, enviada pelo Stripe (boleto, e Pix se ligado). */
export const cobrancaAvulsa = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      tenantId: z.string().uuid(),
      descricao: z.string().trim().min(3, "Descreva a cobrança.").max(200),
      valor: z.number().min(1, "Valor mínimo de R$ 1,00.").max(100_000),
      diasParaPagar: Dias.default(7),
    }),
  )
  .handler(async ({ data: d }) => {
    await exigirAdmin();
    const st = exigirStripe();
    const customer = await garantirCustomer(st, d.tenantId);
    const fatura = await st.invoices.create({
      customer,
      collection_method: "send_invoice",
      days_until_due: d.diasParaPagar,
      auto_advance: true,
      currency: "brl",
      payment_settings: { payment_method_types: await metodosFatura() },
      metadata: { app: APP, tenant_id: d.tenantId, avulsa: "1" },
    });
    await st.invoiceItems.create({
      customer,
      invoice: fatura.id,
      amount: Math.round(d.valor * 100),
      currency: "brl",
      description: d.descricao,
    });
    await st.invoices.finalizeInvoice(fatura.id!);
    await st.invoices.sendInvoice(fatura.id!);
    await sincronizarFatura(fatura.id!, st);
  });

/** Ações numa fatura do Stripe: reenviar, marcar paga fora do Stripe, estornar (total) ou anular. */
export const acaoFatura = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      faturaId: z.string().uuid(),
      acao: z.enum(["reenviar", "marcar_paga", "estornar", "anular"]),
    }),
  )
  .handler(async ({ data }) => {
    await exigirAdmin();
    const st = exigirStripe();
    const [f] = await dbAdmin().select().from(s.faturas).where(eq(s.faturas.id, data.faturaId));
    if (!f?.stripeInvoiceId) throw new Error("Fatura sem registro no Stripe.");
    const id = f.stripeInvoiceId;
    if (data.acao === "reenviar") {
      if (f.status !== "open") throw new Error("Só fatura em aberto pode ser reenviada.");
      const inv = await st.invoices.retrieve(id);
      if (inv.collection_method !== "send_invoice")
        throw new Error("Fatura de cartão é cobrada automaticamente; não há e-mail para reenviar.");
      await st.invoices.sendInvoice(id);
    } else if (data.acao === "marcar_paga") {
      if (f.status !== "open") throw new Error("Só fatura em aberto pode ser marcada como paga.");
      await st.invoices.pay(id, { paid_out_of_band: true });
    } else if (data.acao === "anular") {
      if (f.status !== "open") throw new Error("Só fatura em aberto pode ser anulada.");
      await st.invoices.voidInvoice(id);
    } else {
      if (f.status !== "paid") throw new Error("Só fatura paga pode ser estornada.");
      const pagamentos = await st.invoicePayments.list({ invoice: id });
      const pi = pagamentos.data
        .filter((p) => p.status === "paid")
        .map((p) => p.payment.payment_intent)
        .find(Boolean);
      if (!pi) throw new Error("Fatura paga fora do Stripe: não há pagamento para estornar.");
      await st.refunds.create(
        { payment_intent: typeof pi === "string" ? pi : pi.id },
        { idempotencyKey: `concierge-estorno-${id}` },
      );
    }
    await sincronizarFatura(id, st);
  });

/** Cancela no fim do período (padrão) ou na hora. */
export const cancelarAssinatura = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tenantId: z.string().uuid(), agora: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    await exigirAdmin();
    const st = exigirStripe();
    const a = await assinaturaDo(data.tenantId);
    if (!a?.stripeSubscriptionId || ENCERRADA.has(a.status))
      throw new Error("O cliente não tem assinatura ativa no Stripe.");
    if (data.agora) await st.subscriptions.cancel(a.stripeSubscriptionId);
    else await st.subscriptions.update(a.stripeSubscriptionId, { cancel_at_period_end: true });
    await sincronizarAssinatura(a.stripeSubscriptionId, st);
  });

/** NFS-e emitida fora do sistema (manual por enquanto). Vazio apaga o registro. */
export const registrarNfse = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      faturaId: z.string().uuid(),
      numero: z.string().trim().max(40),
      emitidaEm: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
        .nullable(),
    }),
  )
  .handler(async ({ data }) => {
    await exigirAdmin();
    const numero = data.numero || null;
    if (numero && !data.emitidaEm) throw new Error("Informe a data de emissão da nota.");
    const db = dbAdmin();
    const [f] = await db
      .select({ status: s.faturas.status })
      .from(s.faturas)
      .where(eq(s.faturas.id, data.faturaId));
    if (!f) throw new Error("Fatura não encontrada.");
    if (numero && f.status !== "paid") throw new Error("Só fatura paga recebe nota.");
    await db
      .update(s.faturas)
      .set({ nfseNumero: numero, nfseEmitidaEm: numero ? data.emitidaEm : null })
      .where(eq(s.faturas.id, data.faturaId));
  });

export interface StatusStripe {
  configurado: boolean;
  modo: "teste" | "producao" | null;
  conta: string | null;
  ultimoWebhook: string | null;
  pixAtivo: boolean;
}

/** Card do Stripe no financeiro: sem chaves na tela, só modo, conta e último webhook. */
export const statusStripe = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusStripe> => {
    await exigirAdmin();
    const [w] = await dbAdmin()
      .select({ ultimo: max(s.stripeEventos.recebidoEm) })
      .from(s.stripeEventos);
    const base = {
      ultimoWebhook: w?.ultimo?.toISOString() ?? null,
      pixAtivo: await pixAtivo(),
    };
    if (!stripeConfigurado()) return { configurado: false, modo: null, conta: null, ...base };
    const chave = process.env.STRIPE_SECRET_KEY!;
    let conta: string | null = null;
    try {
      const a = await stripe().accounts.retrieveCurrent();
      conta = a.settings?.dashboard?.display_name || a.business_profile?.name || a.id;
    } catch {
      // Chave restrita sem leitura da conta: o card mostra só o modo.
    }
    return {
      configurado: true,
      modo: chave.includes("_live_") ? "producao" : "teste",
      conta,
      ...base,
    };
  },
);

/** Liga ou desliga o Pix nas faturas enviadas (boleto e avulsa). Pix recorrente: ver #45. */
export const definirPix = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ativo: z.boolean() }))
  .handler(async ({ data }) => {
    await exigirAdmin();
    await dbAdmin()
      .insert(s.plataformaConfig)
      .values({ chave: "pix_ativo", valor: data.ativo })
      .onConflictDoUpdate({
        target: s.plataformaConfig.chave,
        set: { valor: data.ativo, atualizadoEm: new Date() },
      });
  });
