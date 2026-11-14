/**
 * Dados de exemplo para desenvolvimento, a partir dos mocks de src/data. APAGA os dados atuais.
 *   bun run db:seed
 * Os mocks não têm cliente: condomínios, moradores, demandas e fornecedores vão para o 1º cliente.
 */
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { DEMANDAS_EXEMPLO as DEMANDAS } from "./dados-exemplo/demandas";
import { listFaturas } from "../src/data/faturas";
import { listSuppliers } from "../src/data/fornecedores";
import { CONDOMINIOS, MORADORES_EXEMPLO } from "./dados-exemplo/moradores";
import { PLANOS } from "../src/data/planos";
import { listTenants } from "../src/data/tenants";
import { dbAdmin, schema as s } from "../src/server/db";

if (process.env.NODE_ENV === "production") throw new Error("seed não roda em produção");

const db = dbAdmin();
const senha = process.env.SEED_SENHA ?? "operacondo123";
const so = (v?: string) => (v ?? "").replace(/\D/g, "");
const e164 = (v?: string) => (so(v).length >= 10 ? `+${so(v)}` : null);
const dataBr = (v?: string) => {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const MES: Record<string, string> = {
  Jan: "01",
  Fev: "02",
  Mar: "03",
  Abr: "04",
  Mai: "05",
  Jun: "06",
  Jul: "07",
  Ago: "08",
  Set: "09",
  Out: "10",
  Nov: "11",
  Dez: "12",
};
const desde = (v?: string) => {
  const m = v?.match(/^(\w{3}) (\d{4})$/);
  return m && MES[m[1]] ? `${m[2]}-${MES[m[1]]}-01` : null;
};
/** "09:42" → hoje nesse horário. */
const hoje = (hhmm: string) => {
  const d = new Date();
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
};

async function main() {
  // Apaga tudo (as tabelas de cliente caem em cascata a partir de tenants).
  await db.execute(sql`delete from tenants`);
  await db.execute(sql`delete from "user"`);
  await db.execute(sql`delete from planos`);
  await db.execute(sql`delete from stripe_eventos`);

  // Planos: os de venda vêm do mock; o trial (não vendável) segue o CLAUDE.md.
  await db.insert(s.planos).values([
    {
      id: "trial",
      nome: "Trial",
      precoMensal: 0,
      limiteCondominios: 1,
      limiteMoradores: 50,
      limiteDocumentos: 5,
      limiteRespostasIaMes: 150,
      tetoCustoIaMes: 15,
      usaConselheiro: false,
      vendavel: false,
    },
    ...PLANOS.map((p) => ({
      id: p.id,
      nome: p.nome,
      precoMensal: p.precoMensal,
      limiteCondominios: p.condominios,
      limiteMoradores: p.moradores,
      limiteDocumentos: p.condominios * 50,
      limiteRespostasIaMes: p.msgsMes,
      tetoCustoIaMes: p.precoMensal * 0.3,
      usaConselheiro: p.id !== "starter",
    })),
  ]);

  // Clientes, assinaturas e faturas.
  const tenantId = new Map<string, string>();
  const assinaturaId = new Map<string, string>();
  const statusTenant = { ativo: "ativo", trial: "trial", suspenso: "suspenso" } as const;
  for (const t of listTenants()) {
    const [row] = await db
      .insert(s.tenants)
      .values({
        razaoSocial: t.razaoSocial,
        nomeFantasia: t.nomeFantasia,
        cnpj: so(t.cnpj),
        email: t.email,
        telefone: t.telefone,
        cidade: t.cidade,
        uf: t.uf,
        responsavel: t.responsavel,
        status: statusTenant[t.status],
        stripeCustomerId: t.stripeCustomerId,
        suspensao: t.status === "suspenso" ? "parcial" : "nenhuma",
      })
      .returning({ id: s.tenants.id });
    tenantId.set(t.id, row.id);
    const [a] = await db
      .insert(s.assinaturas)
      .values({
        tenantId: row.id,
        planoId: t.status === "trial" ? "trial" : t.plano,
        stripeSubscriptionId: t.stripeSubscriptionId,
        status: t.status === "trial" ? "trialing" : t.status === "suspenso" ? "past_due" : "active",
        formaCobranca: "cartao",
      })
      .returning({ id: s.assinaturas.id });
    assinaturaId.set(t.id, a.id);
  }

  const statusFatura = {
    paid: "paid",
    open: "open",
    past_due: "open",
    void: "void",
    refunded: "paid",
  } as const;
  const metodo = { card: "cartao", boleto: "boleto", pix: "pix" } as const;
  for (const f of listFaturas()) {
    const tid = tenantId.get(f.tenantId);
    if (!tid) continue;
    await db.insert(s.faturas).values({
      tenantId: tid,
      assinaturaId: assinaturaId.get(f.tenantId),
      stripeInvoiceId: f.stripeInvoiceId,
      numero: `OC-${f.periodo}`,
      status: statusFatura[f.status],
      valorTotal: f.valor,
      valorPago: f.status === "paid" || f.status === "refunded" ? f.valor : 0,
      valorEstornado: f.status === "refunded" ? f.valor : 0,
      vencimento: f.vencimento,
      pagoEm: f.status === "paid" || f.status === "refunded" ? new Date(f.vencimento) : null,
      metodoPagamento: metodo[f.metodo],
    });
  }

  // Tudo o que é operacional vai para o 1º cliente.
  const t1 = tenantId.get(listTenants()[0].id)!;

  // Usuários: Admin Master e o síndico do 1º cliente.
  const usuarios = [
    { id: "usr_admin", name: "Admin OperaCondo", email: "admin@operacondo.local", role: "admin" },
    {
      id: "usr_sindico",
      name: listTenants()[0].responsavel,
      email: "sindico@operacondo.local",
      role: "user",
    },
  ];
  const hash = await hashPassword(senha);
  for (const u of usuarios) {
    await db.insert(s.user).values({ ...u, emailVerified: true });
    await db.insert(s.account).values({
      id: `acc_${u.id}`,
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: hash,
    });
  }
  const [sindico] = await db
    .insert(s.membros)
    .values({ tenantId: t1, userId: "usr_sindico", papel: "sindico" })
    .returning({ id: s.membros.id });

  await db.insert(s.whatsappCanais).values({
    tenantId: t1,
    phoneE164: "+5511988881111",
    provider: "zapi",
    status: "desconectado",
  });

  // Condomínios, unidades, moradores e contatos.
  const condoId = new Map<string, string>();
  for (const c of CONDOMINIOS) {
    const [cidade, uf] = c.cidade.split(" — ");
    const [row] = await db
      .insert(s.condominios)
      .values({ tenantId: t1, nome: c.nome, tipo: c.tipo, cidade, uf, unidadesTotal: c.unidades })
      .returning({ id: s.condominios.id });
    condoId.set(c.id, row.id);
    await db
      .insert(s.agenteConfig)
      .values({ tenantId: t1, condominioId: row.id, limiteAprovacao: 1500 });
  }

  const statusMorador = {
    Residente: "residente",
    Locatário: "locatario",
    Proprietário: "proprietario",
    Inativo: "inativo",
  } as const;
  const moradorId = new Map<string, { id: string; unidadeId: string; condominioId: string }>();
  for (const m of MORADORES_EXEMPLO) {
    const cid = condoId.get(m.condominioId)!;
    const e = m.endereco;
    const [u] = await db
      .insert(s.unidades)
      .values(
        e.tipo === "vertical"
          ? {
              tenantId: t1,
              condominioId: cid,
              bloco: e.bloco,
              andar: e.andar,
              apto: e.apto,
              vagas: m.vagas,
            }
          : { tenantId: t1, condominioId: cid, quadra: e.quadra, casa: e.casa, vagas: m.vagas },
      )
      .returning({ id: s.unidades.id });
    if (m.status === "Vago") continue; // unidade sem morador
    const [row] = await db
      .insert(s.moradores)
      .values({
        tenantId: t1,
        condominioId: cid,
        unidadeId: u.id,
        nome: m.nome,
        status: statusMorador[m.status],
        cadastro: "aprovado",
        cpfFinal: m.cpf?.slice(-2) ?? null,
        email: m.email,
        pets: m.pets,
        desde: desde(m.desde),
        desativadoEm: m.desativadoEm ? new Date() : null,
      })
      .returning({ id: s.moradores.id });
    moradorId.set(m.id, { id: row.id, unidadeId: u.id, condominioId: cid });
    const fone = e164(m.contato);
    if (fone)
      await db
        .insert(s.moradorContatos)
        .values({ tenantId: t1, moradorId: row.id, condominioId: cid, phoneE164: fone });
  }

  // Fornecedores e documentos.
  const estado = {
    Homologado: "homologado",
    "Em análise": "em_analise",
    Renovação: "renovacao",
    Inativo: "inativo",
  } as const;
  for (const f of listSuppliers()) {
    const [row] = await db
      .insert(s.fornecedores)
      .values({
        tenantId: t1,
        nome: f.nome,
        categoria: f.categoria,
        cnpj: so(f.cnpj),
        estado: estado[f.estado],
        rating: f.rating,
        contato: f.contato,
        email: f.email,
        criteriosOk: f.homologacao.criteriosOk,
        homologacaoValidaAte: dataBr(f.homologacao.validoAte),
      })
      .returning({ id: s.fornecedores.id });
    for (const d of f.docs)
      await db.insert(s.fornecedorDocumentos).values({
        tenantId: t1,
        fornecedorId: row.id,
        nome: d.name,
        tipo: d.kind,
        validoAte: dataBr(d.validUntil),
      });
  }

  // Demandas, linha do tempo e anexos.
  const prio = { Crítica: "critica", Alta: "alta", Normal: "normal" } as const;
  const cat = {
    Manutenção: "manutencao",
    Segurança: "seguranca",
    Limpeza: "limpeza",
    Administrativo: "administrativo",
  } as const;
  const canal = {
    WhatsApp: "whatsapp",
    Portal: "portal",
    Portaria: "portaria",
    IA: "ia",
    Sistema: "sistema",
  } as const;
  const aurora = condoId.get(CONDOMINIOS[0].id)!;
  for (const d of DEMANDAS) {
    const m = d.moradorId ? moradorId.get(d.moradorId) : undefined;
    const horas = Number(d.sla?.match(/(\d+)\s*h/)?.[1]);
    const [row] = await db
      .insert(s.demandas)
      .values({
        tenantId: t1,
        codigo: d.id,
        condominioId: m?.condominioId ?? aurora,
        unidadeId: m?.unidadeId,
        moradorId: m?.id,
        titulo: d.title,
        descricao: d.description,
        local: d.location,
        categoria: cat[d.category],
        prioridade: prio[d.priority],
        coluna: d.column,
        slaAte: horas ? new Date(Date.now() + horas * 3600_000) : null,
        responsavelId: d.assigned ? sindico.id : null,
        custoEstimado: d.cost?.estimated,
        custoAprovado: d.cost?.approved,
      })
      .returning({ id: s.demandas.id });
    for (const ev of d.timeline)
      await db.insert(s.demandaEventos).values({
        tenantId: t1,
        demandaId: row.id,
        ator: ev.actor,
        acao: ev.action,
        detalhe: ev.detail,
        canal: ev.channel ? canal[ev.channel] : "sistema",
        em: hoje(ev.at),
      });
    for (const a of d.attachments)
      await db.insert(s.demandaAnexos).values({
        tenantId: t1,
        demandaId: row.id,
        nome: a.name,
        tipo: a.kind,
        storagePath: `${t1}/${m?.condominioId ?? aurora}/demandas/${a.name}`,
      });
  }

  const [{ n }] = (await db.execute<{ n: number }>(sql`select count(*)::int n from demandas`)).rows;
  console.log(
    `Seed ok: ${listTenants().length} clientes, ${CONDOMINIOS.length} condomínios, ${moradorId.size} moradores, ${n} demandas.`,
  );
  console.log(`Login: admin@operacondo.local / sindico@operacondo.local — senha: ${senha}`);
}

await main();
process.exit(0);
