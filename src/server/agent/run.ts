/**
 * Uma resposta do agente (fila "agente", um job por conversa). Claude Haiku 5.5 com os documentos
 * do condomínio em cache e citações da API. Sem base documental → a conversa vai para o síndico.
 * ponytail: sem ferramentas ainda (#23 traz o Tool Runner); aqui é uma chamada só.
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { carregarContexto, COLECAO_NOME, type Contexto } from "@/server/agent/contexto";
import { mensagens, SEM_BASE, sistema } from "@/server/agent/prompt";
import { schema as s, withTenant, type Tx } from "@/server/db";
import { HAIKU, uso } from "@/server/llm";
import type { JobAgente } from "@/server/queue";
import { enviarNaConversa } from "@/server/whatsapp/send";

export const MODELO_AGENTE = process.env.AGENTE_MODELO ?? HAIKU;

export const AVISO_SINDICO =
  "Recebi sua mensagem e encaminhei ao síndico, que responde por aqui em breve.";

/** "Regimento Interno, Art. 12" a partir das citações da resposta (no máximo 3). */
export function fontes(r: Anthropic.Message, ctx: Contexto): string[] {
  const vistas = new Set<string>();
  for (const b of r.content) {
    if (b.type !== "text") continue;
    for (const c of b.citations ?? []) {
      if (c.type !== "content_block_location") continue;
      const d = ctx.documentos[c.document_index];
      if (!d) continue;
      const refs = d.trechos
        .slice(c.start_block_index, c.end_block_index)
        .map((t) => t.referencia)
        .filter((x): x is string => !!x && x !== "Preâmbulo");
      const doc = d.colecao === "ata" ? d.titulo : COLECAO_NOME[d.colecao];
      vistas.add(refs.length ? `${doc}, ${[...new Set(refs)].join(", ")}` : doc);
    }
  }
  return [...vistas].slice(0, 3);
}

async function escalar(tx: Tx, ctx: Contexto) {
  await tx
    .update(s.conversas)
    .set({ estado: "aguardando_sindico" })
    .where(and(eq(s.conversas.id, ctx.conversa.id), eq(s.conversas.estado, "ia")));
  await enviarNaConversa(tx, ctx.conversa, AVISO_SINDICO, "sistema");
}

/** `ultimaTentativa`: se a API falhar de vez, a conversa vai para o síndico (morador não fica sem resposta). */
export async function responder(job: JobAgente, ultimaTentativa = false): Promise<void> {
  const ctx = await withTenant(job.tenantId, (tx) => carregarContexto(tx, job.conversaId));
  // Só responde conversa com a IA e com mensagem do morador esperando.
  const ultima = ctx?.historico.at(-1);
  if (!ctx || ctx.conversa.estado !== "ia" || ultima?.direcao !== "entrada") return;

  const inicio = Date.now();
  let r: Anthropic.Message;
  try {
    r = await new Anthropic().messages.create({
      model: MODELO_AGENTE,
      max_tokens: 2000,
      system: sistema(ctx),
      messages: mensagens(ctx),
    });
  } catch (e) {
    if (!ultimaTentativa) throw e;
    console.error(`[agente] conversa ${job.conversaId}: falhou de vez, vai para o síndico`, e);
    await withTenant(job.tenantId, (tx) => escalar(tx, ctx));
    return;
  }

  const texto = r.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  const semBase =
    !texto ||
    texto.startsWith(SEM_BASE) ||
    r.stop_reason === "refusal" ||
    r.stop_reason === "max_tokens";

  await withTenant(job.tenantId, async (tx) => {
    await tx.insert(s.llmExecucoes).values({
      tenantId: job.tenantId,
      conversaId: ctx.conversa.id,
      condominioId: ctx.conversa.condominioId,
      ...uso(r, MODELO_AGENTE, inicio),
    });
    // Enquanto o modelo pensava: o síndico assumiu, ou chegou outra mensagem (o próximo job
    // responde as duas juntas). Nesses casos esta resposta é descartada.
    const [cv] = await tx
      .select({ estado: s.conversas.estado })
      .from(s.conversas)
      .where(eq(s.conversas.id, ctx.conversa.id))
      .for("update");
    const [maisNova] = await tx
      .select({ id: s.mensagens.id })
      .from(s.mensagens)
      .where(eq(s.mensagens.conversaId, ctx.conversa.id))
      .orderBy(desc(s.mensagens.criadoEm), desc(s.mensagens.direcao))
      .limit(1);
    if (cv?.estado !== "ia" || maisNova?.id !== ultima.id) return;

    // ponytail: o rascunho depois de [SEM_BASE] ainda não é guardado (#24 mostra ao síndico).
    if (semBase) return escalar(tx, ctx);

    const f = fontes(r, ctx);
    const assinatura = ctx.config.opcoes.assinatura.trim();
    const mensagem = [texto, f.length ? `📄 ${f.join("; ")}` : "", assinatura]
      .filter(Boolean)
      .join("\n\n");
    await enviarNaConversa(tx, ctx.conversa, mensagem, "ia");
  });
}
