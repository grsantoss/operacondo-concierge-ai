/**
 * Cria ou atualiza no Stripe os produtos e preços do Concierge, a partir da tabela `planos`
 * (vendáveis e ativos) e do adicional WhatsApp gerenciado. Idempotente: produto pelo id
 * `concierge_{item}`, preço pelo lookup_key `concierge_{item}_{mensal|anual}`. Preço que mudou
 * vira um preço novo (o lookup_key é transferido) e o antigo é arquivado.
 *
 *   bun run stripe:seed              # chave de teste (sk_test_/rk_test_)
 *   bun run stripe:seed --producao   # obrigatório com chave de produção
 */
import { and, eq } from "drizzle-orm";
import {
  APP,
  WHATSAPP_GERENCIADO,
  mesmoPreco,
  paramsDoPreco,
  precosDoAdicional,
  precosDoPlano,
  produtoId,
  type PrecoDesejado,
  type PrecoStripe,
} from "../src/server/billing/catalogo";
import { chaveDeProducao, stripe } from "../src/server/billing/stripe";
import { dbAdmin, schema as s } from "../src/server/db";

if (chaveDeProducao() && !process.argv.includes("--producao")) {
  throw new Error("STRIPE_SECRET_KEY é de produção: rode com --producao se for mesmo isso.");
}

const st = stripe();
const db = dbAdmin();

async function garantirProduto(item: string, nome: string, descricao: string) {
  const id = produtoId(item);
  const dados = { name: nome, description: descricao, active: true, metadata: { app: APP, item } };
  try {
    await st.products.retrieve(id);
    await st.products.update(id, dados);
    return `${id} atualizado`;
  } catch (err) {
    if ((err as { code?: string }).code !== "resource_missing") throw err;
    await st.products.create({ id, ...dados });
    return `${id} criado`;
  }
}

async function garantirPrecos(desejados: PrecoDesejado[]) {
  const { data } = await st.prices.list({
    lookup_keys: desejados.map((d) => d.lookupKey),
    active: true,
    expand: ["data.tiers"],
  });
  const saida: string[] = [];
  for (const d of desejados) {
    const atual = data.find((p) => p.lookup_key === d.lookupKey);
    if (atual && mesmoPreco(atual as unknown as PrecoStripe, d)) {
      saida.push(`${d.lookupKey} sem mudança (${atual.id})`);
      continue;
    }
    const novo = await st.prices.create(paramsDoPreco(d));
    if (atual) await st.prices.update(atual.id, { active: false });
    saida.push(
      `${d.lookupKey} ${atual ? `trocado (${atual.id} arquivado)` : "criado"} → ${novo.id}`,
    );
  }
  return saida;
}

const planos = await db
  .select()
  .from(s.planos)
  .where(and(eq(s.planos.vendavel, true), eq(s.planos.ativo, true)));

const log: string[] = [];
for (const p of planos) {
  const adicional = p.precoCondominioAdicional
    ? `; condomínio adicional R$ ${p.precoCondominioAdicional}`
    : "";
  log.push(
    await garantirProduto(
      p.id,
      `Concierge ${p.nome}`,
      `Atendimento com IA no WhatsApp e no e-mail. ${p.condominiosInclusos} condomínio(s) incluso(s)${adicional}.`,
    ),
  );
  const precoPlano = {
    id: p.id,
    nome: p.nome,
    precoMensal: Number(p.precoMensal),
    condominiosInclusos: p.condominiosInclusos,
    precoCondominioAdicional:
      p.precoCondominioAdicional == null ? null : Number(p.precoCondominioAdicional),
  };
  log.push(...(await garantirPrecos(precosDoPlano(precoPlano))));
  await db
    .update(s.planos)
    .set({ stripeProductId: produtoId(p.id) })
    .where(eq(s.planos.id, p.id));
}

log.push(
  await garantirProduto(
    WHATSAPP_GERENCIADO.id,
    `Concierge ${WHATSAPP_GERENCIADO.nome}`,
    "Número de WhatsApp fornecido pela OperaCondo (repasse do provedor), por número.",
  ),
);
log.push(...(await garantirPrecos(precosDoAdicional())));

console.log(log.join("\n"));
process.exit(0);
