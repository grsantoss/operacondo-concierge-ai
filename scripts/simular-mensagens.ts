/**
 * Só para desenvolvimento: simula mensagens chegando pelo WhatsApp e pelo e-mail, pelo mesmo
 * caminho do webhook (entrada → roteamento → conversa), sem Z-API nem SES. Serve para ver
 * `/app/agente` com dados. Nada é enviado ao morador.
 *
 *   bun run simular                      → cliente do sindico@operacondo.local
 *   bun run simular georg@rtz.com.br     → cliente deste login
 *
 * O WhatsApp usa uma Z-API falsa local: as respostas automáticas ficam só gravadas na conversa.
 * Se o canal não tiver credenciais, recebe credenciais de mentira durante a simulação e volta
 * ao que era no fim.
 *
 * Com `ANTHROPIC_API_KEY`, o agente responde de verdade (custa centavos). Sem ela, a conversa da
 * reserva ganha um rascunho de exemplo, para ver o cartão "Aprovar e enviar".
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { responder } from "@/server/agent/run";
import { cifrar } from "@/server/cripto";
import { dbAdmin, schema as s } from "@/server/db";
import { processarEmail } from "@/server/email-entrada/processar";
import { iaConfigurada } from "@/server/llm";
import { processarConversa } from "@/server/pipeline/processar";
import { rotear } from "@/server/pipeline/roteamento";

if (process.env.NODE_ENV === "production") throw new Error("Simulação só em desenvolvimento.");

const login = process.argv[2] ?? "sindico@operacondo.local";
const db = dbAdmin();
const [m] = await db
  .select({ tenantId: s.membros.tenantId })
  .from(s.membros)
  .innerJoin(s.user, eq(s.user.id, s.membros.userId))
  .where(eq(s.user.email, login));
if (!m) throw new Error(`Login ${login} não encontrado (rode bun run db:seed).`);
const tenantId = m.tenantId;

// Moradores de exemplo com telefone e e-mail (do seed).
const moradores = await db
  .select({
    nome: s.moradores.nome,
    email: s.moradores.email,
    telefone: s.moradorContatos.phoneE164,
  })
  .from(s.moradores)
  .innerJoin(s.moradorContatos, eq(s.moradorContatos.moradorId, s.moradores.id))
  .where(and(eq(s.moradores.tenantId, tenantId), isNotNull(s.moradores.email)))
  .limit(3);
if (moradores.length < 3) throw new Error("Faltam moradores com telefone e e-mail no cliente.");
const [ana, marcelo, julia] = moradores as [
  (typeof moradores)[0],
  (typeof moradores)[0],
  (typeof moradores)[0],
];

let agentes = 0;
async function agente(job: { tenantId: string; conversaId: string } | null) {
  if (!job) return;
  agentes++;
  await responder(job, true).catch((e) => console.warn("  agente falhou:", (e as Error).message));
}

// Z-API falsa: o que seria enviado fica só gravado em `mensagens`.
const zapi = Bun.serve({
  port: 0,
  fetch: () => Response.json({ messageId: `SIM-${crypto.randomUUID()}` }),
});
process.env.ZAPI_URL = `http://localhost:${zapi.port}`;

// WhatsApp
const [canal] = await db
  .select()
  .from(s.whatsappCanais)
  .where(eq(s.whatsappCanais.tenantId, tenantId));
if (!canal) console.warn("Sem canal de WhatsApp: pulei as mensagens do WhatsApp.");
else {
  const original = { instanceId: canal.instanceId, credenciaisCifradas: canal.credenciaisCifradas };
  if (!canal.instanceId || !canal.credenciaisCifradas)
    await db
      .update(s.whatsappCanais)
      .set({
        instanceId: "SIMULACAO",
        credenciaisCifradas: cifrar(JSON.stringify({ token: "sim" })),
      })
      .where(eq(s.whatsappCanais.id, canal.id));
  try {
    for (const [quem, texto] of [
      [ana, "Boa noite! Até que horas posso usar a churrasqueira no sábado?"],
      [marcelo, "Tem cheiro de gás forte no corredor do 3º andar!"],
    ] as const) {
      await db.insert(s.whatsappEntradas).values({
        tenantId,
        canalId: canal.id,
        telefone: quem.telefone,
        providerMsgId: `SIM-${crypto.randomUUID()}`,
        payload: { type: "ReceivedCallback", text: { message: texto } },
      });
      const job = { tenantId, canalId: canal.id, telefone: quem.telefone };
      let r: Awaited<ReturnType<typeof rotear>> | null = null;
      await processarConversa(job, async (e) => {
        r = await rotear(job, e);
      });
      console.log(`WhatsApp de ${quem.nome}: ${texto}`);
      await agente((r as Awaited<ReturnType<typeof rotear>> | null)?.agente ?? null);
    }
  } finally {
    await db.update(s.whatsappCanais).set(original).where(eq(s.whatsappCanais.id, canal.id));
  }
}

// E-mail
const [canalEmail] = await db
  .select()
  .from(s.emailCanais)
  .where(eq(s.emailCanais.tenantId, tenantId));
if (!canalEmail)
  throw new Error(
    "Sem endereço de e-mail: abra Configurações → Integrações uma vez (com EMAIL_DOMINIO).",
  );
const emails = [
  {
    de: julia.email!,
    assunto: "Reserva do salão de festas",
    texto: `Boa tarde,\n\nGostaria de reservar o salão de festas para o aniversário do meu filho. Com quanto tempo de antecedência preciso pedir?\n\nObrigada,\n${julia.nome}`,
  },
  {
    de: "comercial@limpamais.com.br",
    assunto: "Proposta — Contrato de limpeza áreas comuns",
    texto:
      "Prezado(a) Síndico(a),\n\nSegue nossa proposta para a limpeza das áreas comuns: 2 colaboradores fixos, R$ 8.400,00 por mês.\n\nCarlos Mendes — Comercial",
  },
  {
    de: ana.email!,
    assunto: "URGENTE — Vazamento no apartamento",
    texto: `Bom dia,\n\nEstá vazando água do teto do banheiro, vindo do apartamento de cima. Podem mandar alguém hoje?\n\n${ana.nome}`,
  },
];
let reserva: string | null = null;
for (const e of emails) {
  const messageId = `<sim-${crypto.randomUUID()}@exemplo.com>`;
  const bruto = [
    `From: ${e.de}`,
    `To: ${canalEmail.endereco}`,
    `Subject: ${e.assunto}`,
    `Message-ID: ${messageId}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    e.texto,
  ].join("\r\n");
  const [entrada] = await db
    .insert(s.emailEntradas)
    .values({
      tenantId,
      emailCanalId: canalEmail.id,
      messageId,
      s3Chave: `simulacao/${messageId}`,
      autenticacao: { spf: "PASS", dkim: "PASS", dmarc: "PASS", spam: "PASS", virus: "PASS" },
      payload: {},
    })
    .returning();
  const r = await processarEmail(
    entrada!.id,
    { ler: async () => new TextEncoder().encode(bruto), apagar: async () => {} },
    async () => {},
  );
  console.log(`E-mail de ${e.de}: ${e.assunto}`);
  if (e.de === julia.email) reserva = r.conversaId;
  await agente(r.agente);
}

if (!iaConfigurada() && reserva)
  await db
    .update(s.conversas)
    .set({
      estado: "aguardando_sindico",
      rascunho: `Olá, ${julia.nome},\n\nA reserva do salão de festas deve ser feita com pelo menos 7 dias de antecedência.\n\n(Rascunho de exemplo da simulação local: sem ANTHROPIC_API_KEY o agente não roda.)`,
      rascunhoMotivo: "Resposta por e-mail aguardando aprovação",
    })
    .where(eq(s.conversas.id, reserva));

console.log(
  `\nPronto. Abra /app/agente (filtro Todos / WhatsApp / E-mail).${
    iaConfigurada()
      ? ` O agente rodou ${agentes} vez(es).`
      : " Sem ANTHROPIC_API_KEY: só o rascunho de exemplo."
  }`,
);
zapi.stop();
process.exit(0);
