/**
 * Uma resposta do agente (fila "agente", um job por conversa). Claude Haiku 5.5 com os documentos
 * do condomínio em cache, citações da API e as ferramentas de `tools.ts` (Tool Runner do SDK).
 * Sem base documental, ou escalado pela ferramenta → a conversa vai para o síndico.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta";
import {
  getActiveTraceId,
  propagateAttributes,
  startActiveObservation,
  startObservation,
  type LangfuseAgent,
} from "@langfuse/tracing";
import { and, desc, eq } from "drizzle-orm";
import { carregarContexto, COLECAO_NOME, type Contexto } from "@/server/agent/contexto";
import { assinaturaAtual, iaNoLimite, usoMensal } from "@/server/billing/limites";
import { mensagens, SEM_BASE, sistema } from "@/server/agent/prompt";
import { ferramentas, type Efeitos } from "@/server/agent/tools";
import { schema as s, withTenant, type Tx } from "@/server/db";
import { HAIKU, uso } from "@/server/llm";
import { langfuseConfigurado } from "@/server/observability";
import type { JobAgente } from "@/server/queue";
import { enviarNaConversa } from "@/server/whatsapp/send";

export const MODELO_AGENTE = process.env.AGENTE_MODELO ?? HAIKU;
/** Chamadas ao modelo por resposta (cada rodada de ferramentas conta uma). */
const MAX_RODADAS = 6;

export const AVISO_SINDICO =
  "Recebi sua mensagem e encaminhei ao síndico, que responde por aqui em breve.";

/** "Regimento Interno, Art. 12" a partir das citações da resposta (no máximo 3). */
export function fontes(r: BetaMessage, ctx: Contexto): string[] {
  const vistas = new Set<string>();
  for (const b of r.content) {
    if (b.type !== "text") continue;
    for (const c of b.citations ?? []) {
      // Trecho achado por buscar_regras: o título já vem pronto ("Regimento Interno, Art. 3").
      if (c.type === "search_result_location") {
        if (c.title) vistas.add(c.title);
        continue;
      }
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

/** O síndico vê o motivo e, quando houver, o rascunho para aprovar, editar ou reescrever (#24). */
async function escalar(
  tx: Tx,
  ctx: Contexto,
  motivo: string,
  rascunho: string | null = null,
  texto = AVISO_SINDICO,
) {
  await tx
    .update(s.conversas)
    .set({ estado: "aguardando_sindico", rascunho, rascunhoMotivo: motivo })
    .where(and(eq(s.conversas.id, ctx.conversa.id), eq(s.conversas.estado, "ia")));
  await enviarNaConversa(tx, ctx.conversa, texto, texto === AVISO_SINDICO ? "sistema" : "ia");
}

/**
 * `ultimaTentativa`: se a API falhar de vez, a conversa vai para o síndico (morador não fica sem
 * resposta). `recomeco`: já é a 2ª passada depois de definir_condominio trocar o condomínio.
 */
export function responder(job: JobAgente, ultimaTentativa = false, recomeco = false) {
  // Um rastro por resposta no Langfuse; a sessão é a conversa. Sem Langfuse, as chamadas abaixo
  // não fazem nada. Dados pessoais saem mascarados pelo processador (observability).
  return propagateAttributes(
    { sessionId: job.conversaId, traceName: "agente", metadata: { tenantId: job.tenantId } },
    () =>
      startActiveObservation(
        "agente",
        (obs) => responderNoRastro(job, ultimaTentativa, recomeco, obs),
        { asType: "agent" },
      ),
  );
}

async function responderNoRastro(
  job: JobAgente,
  ultimaTentativa: boolean,
  recomeco: boolean,
  obs: LangfuseAgent,
): Promise<void> {
  const ctx = await withTenant(job.tenantId, (tx) => carregarContexto(tx, job.conversaId));
  // Só responde conversa com a IA e com mensagem do morador esperando.
  const ultima = ctx?.historico.at(-1);
  if (!ctx || ctx.conversa.estado !== "ia" || ultima?.direcao !== "entrada") {
    obs.update({ output: "nada a responder" });
    return;
  }
  obs.update({
    // Só a conversa (os documentos são grandes e já estão no Langfuse pelo título).
    input: ctx.historico
      .slice(-10)
      .map(
        (m) =>
          `${m.direcao === "entrada" ? "morador" : m.autor}: ${m.texto ?? m.transcricao ?? ""}`,
      ),
    metadata: {
      condominioId: ctx.conversa.condominioId,
      cadastro: ctx.morador?.cadastro ?? "desconhecido",
      documentos: ctx.documentos.map((d) => d.titulo),
    },
  });
  const fim = (resultado: string, saida?: string) =>
    obs.update({ output: saida ?? resultado, metadata: { resultado } });

  // Limite do plano (respostas da IA ou teto de custo do mês): nenhuma chamada ao modelo. O
  // morador recebe o aviso fixo e a conversa vai para o síndico; urgências já foram no roteamento.
  const corte = await withTenant(job.tenantId, async (tx) => {
    const atual = await assinaturaAtual(tx);
    return atual ? iaNoLimite(await usoMensal(tx), atual.limites) : null;
  });
  if (corte) {
    fim(`síndico: ${corte}`);
    await withTenant(job.tenantId, (tx) => escalar(tx, ctx, corte));
    return;
  }
  const traceId = langfuseConfigurado() ? (getActiveTraceId() ?? null) : null;

  const efeitos: Efeitos = { escalar: null, trocouCondominio: false };
  const inicio = Date.now();
  let r: BetaMessage | undefined;
  // Soma das rodadas (cada uma é uma chamada cobrada).
  const total = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  try {
    // Os spans automáticos do SDK duplicariam as gerações abaixo (que têm custo e saída mascarada).
    const cliente = new Anthropic({ openTelemetry: { traces: false, propagation: false } });
    const runner = cliente.beta.messages.toolRunner({
      model: MODELO_AGENTE,
      max_tokens: 2000,
      system: sistema(ctx),
      messages: mensagens(ctx),
      tools: ferramentas(ctx, efeitos),
      max_iterations: MAX_RODADAS,
    });
    let rodadaInicio = new Date();
    for await (const m of runner) {
      r = m;
      // Uma geração por rodada (tool_use ou texto final), com tokens e custo.
      startObservation(
        "claude",
        {
          model: MODELO_AGENTE,
          output: m.content,
          usageDetails: {
            input: m.usage.input_tokens,
            output: m.usage.output_tokens,
            cache_read_input_tokens: m.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: m.usage.cache_creation_input_tokens ?? 0,
          },
          costDetails: { total: uso({ usage: { ...m.usage } }, MODELO_AGENTE, 0).custoUsd },
          metadata: { stop_reason: m.stop_reason },
        },
        { asType: "generation", startTime: rodadaInicio },
      ).end();
      rodadaInicio = new Date();
      total.input_tokens += m.usage.input_tokens;
      total.output_tokens += m.usage.output_tokens;
      total.cache_read_input_tokens += m.usage.cache_read_input_tokens ?? 0;
      total.cache_creation_input_tokens += m.usage.cache_creation_input_tokens ?? 0;
    }
  } catch (e) {
    obs.update({ level: "ERROR", statusMessage: String(e) });
    if (!ultimaTentativa) throw e;
    fim("síndico: A IA não conseguiu responder");
    console.error(`[agente] conversa ${job.conversaId}: falhou de vez, vai para o síndico`, e);
    await withTenant(job.tenantId, (tx) => escalar(tx, ctx, "A IA não conseguiu responder"));
    return;
  }
  if (!r) return;

  const texto = r.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  const semBase =
    !texto ||
    texto.startsWith(SEM_BASE) ||
    r.stop_reason === "refusal" ||
    r.stop_reason === "max_tokens" ||
    // Acabaram as rodadas ainda pedindo ferramenta.
    r.stop_reason === "tool_use";

  await withTenant(job.tenantId, async (tx) => {
    await tx.insert(s.llmExecucoes).values({
      tenantId: job.tenantId,
      conversaId: ctx.conversa.id,
      condominioId: ctx.conversa.condominioId,
      ...uso({ usage: { ...r.usage, ...total } }, MODELO_AGENTE, inicio),
      traceId,
    });
    if (efeitos.trocouCondominio) return fim("trocou de condomínio");
    // Enquanto o modelo pensava: o síndico assumiu, ou chegou outra mensagem (o próximo job
    // responde as duas juntas). Nesses casos esta resposta é descartada; o que as ferramentas
    // gravaram (demanda, cadastro) fica, e o próximo job vê as demandas abertas no contexto.
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
    if (cv?.estado !== "ia" || maisNova?.id !== ultima.id) return fim("descartada", texto);

    if (semBase) {
      const rascunho = texto.startsWith(SEM_BASE) ? texto.slice(SEM_BASE.length).trim() : "";
      const motivo =
        r.stop_reason === "refusal"
          ? "A IA recusou responder"
          : r.stop_reason === "max_tokens" || r.stop_reason === "tool_use"
            ? "A IA não concluiu a resposta"
            : "Sem base documental";
      fim(`síndico: ${motivo}`, texto);
      return escalar(tx, ctx, motivo, rascunho || null);
    }

    const f = fontes(r, ctx);
    const assinatura = ctx.config.opcoes.assinatura.trim();
    const mensagem = [texto, f.length ? `📄 ${f.join("; ")}` : "", assinatura]
      .filter(Boolean)
      .join("\n\n");
    // escalar_sindico: o modelo já escreveu o aviso ao morador; a conversa vai para o síndico.
    if (efeitos.escalar) {
      fim(`síndico: ${efeitos.escalar}`, mensagem);
      return escalar(tx, ctx, efeitos.escalar, null, mensagem);
    }
    fim("enviada", mensagem);
    await enviarNaConversa(tx, ctx.conversa, mensagem, "ia");
  });

  // definir_condominio trocou o condomínio: responde de novo, com os documentos do novo.
  if (efeitos.trocouCondominio && !recomeco) await responder(job, ultimaTentativa, true);
}
