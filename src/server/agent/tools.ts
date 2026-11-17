/**
 * Ferramentas do agente. Cliente, condomínio, morador e telefone vêm SEMPRE do contexto da
 * conversa (closure), nunca do modelo: ele só informa o conteúdo (texto, unidade, título…).
 * Cada ferramenta grava na hora, na própria transação (withTenant → RLS do cliente).
 */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaToolResultContentBlockParam } from "@anthropic-ai/sdk/resources/beta";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import * as z from "zod/v4";
import { PRIO_TELA, proximoCodigoDemanda, SLA_HORAS } from "@/lib/demandas.functions";
import { COLECAO_NOME, type Contexto } from "@/server/agent/contexto";
import { schema as s, withTenant } from "@/server/db";
import { mascararCpf } from "@/server/mascarar";
import { escolherCondominio } from "@/server/pipeline/roteamento";

/** Texto do aceite que o agente apresenta antes do cadastro (versão gravada em `consentimentos`). */
export const LGPD_VERSAO = "whatsapp-v1";
export const LGPD_TEXTO =
  "Para te atender, a administração do condomínio guarda seu nome, unidade e telefone, conforme a LGPD. Você concorda?";

/** O que as ferramentas pedem para o fim da execução (run.ts decide o que fazer). */
export interface Efeitos {
  escalar: string | null;
  trocouCondominio: boolean;
}

const COLUNA_TEXTO = {
  novas: "recebida",
  triagem: "em análise",
  execucao: "em execução",
  resolvidas: "resolvida",
} as const;

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** "Bloco B, apto 302" → unidade do condomínio, se houver exatamente uma que case. */
export function acharUnidade<U extends typeof s.unidades.$inferSelect>(
  texto: string,
  unidades: U[],
): U | null {
  const t = semAcento(texto);
  const numeros: string[] = texto.match(/\d+/g) ?? [];
  const casa = unidades.filter((u) => {
    const num = u.apto ?? u.casa;
    if (!num || !numeros.includes(num.replace(/\D/g, "") || num)) return false;
    const grupo = u.bloco ?? u.quadra;
    // Bloco/quadra: tem de aparecer no texto ("Bloco B", "Quadra 3", "B302"), se a unidade tiver.
    return (
      !grupo ||
      t.includes(`BLOCO${semAcento(grupo)}`) ||
      t.includes(`QUADRA${semAcento(grupo)}`) ||
      t.includes(`${semAcento(grupo)}${num}`)
    );
  });
  return casa.length === 1 ? casa[0]! : null;
}

export function ferramentas(ctx: Contexto, efeitos: Efeitos) {
  const { tenantId } = ctx.conversa;
  const condominioId = ctx.conversa.condominioId!;
  const telefone = ctx.conversa.phoneE164;
  const aprovado = ctx.morador?.cadastro === "aprovado";
  const visiveis: (typeof s.visibilidade.enumValues)[number][] = aprovado
    ? ["publico", "moradores"]
    : ["publico"];
  const tx = <T>(fn: Parameters<typeof withTenant<T>>[1]) => withTenant(tenantId, fn);

  const buscar_regras = betaZodTool({
    name: "buscar_regras",
    description:
      "Busca trechos nos documentos do condomínio (convenção, estatuto, regimento, atas, comunicados). Use quando a resposta não estiver nos documentos já enviados, por exemplo decisões de atas antigas. Devolve trechos citáveis.",
    inputSchema: z.object({
      consulta: z
        .string()
        .min(2)
        .max(200)
        .describe("Palavras-chave em português, ex.: 'mudança horário elevador'"),
    }),
    run: async ({ consulta }) => {
      const linhas = await tx((t) =>
        t
          .select({
            id: s.documentoTrechos.id,
            texto: s.documentoTrechos.texto,
            referencia: s.documentoTrechos.referencia,
            titulo: s.documentos.titulo,
            colecao: s.documentos.colecao,
          })
          .from(s.documentoTrechos)
          .innerJoin(s.documentos, eq(s.documentos.id, s.documentoTrechos.documentoId))
          .where(
            and(
              eq(s.documentoTrechos.condominioId, condominioId),
              inArray(s.documentos.visibilidade, visiveis),
              inArray(s.documentos.status, ["treinado", "revisao"]),
              sql`${s.documentoTrechos.tsv} @@ websearch_to_tsquery('portuguese', ${consulta})`,
            ),
          )
          .orderBy(
            desc(
              sql`ts_rank(${s.documentoTrechos.tsv}, websearch_to_tsquery('portuguese', ${consulta}))`,
            ),
          )
          .limit(6),
      );
      if (!linhas.length) return "Nenhum trecho encontrado para essa busca.";
      return linhas.map(
        (l): BetaToolResultContentBlockParam => ({
          type: "search_result",
          source: `trecho:${l.id}`,
          title: [l.colecao === "ata" ? l.titulo : COLECAO_NOME[l.colecao], l.referencia]
            .filter((x) => x && x !== "Preâmbulo")
            .join(", "),
          content: [{ type: "text", text: mascararCpf(l.texto) }],
          citations: { enabled: true },
        }),
      );
    },
  });

  const definir_condominio = betaZodTool({
    name: "definir_condominio",
    description:
      "Troca o condomínio da conversa quando o morador disser que é de outro condomínio da mesma administração. Depois da troca, a conversa recomeça com os documentos do novo condomínio.",
    inputSchema: z.object({
      condominio: z.string().min(2).max(120).describe("Nome ou número da lista"),
    }),
    run: async ({ condominio }) =>
      tx(async (t) => {
        // Opções: os condomínios deste telefone; número sem cadastro → todos do cliente.
        const meus = await t
          .select({
            condominioId: s.condominios.id,
            nome: s.condominios.nome,
            moradorId: s.moradorContatos.moradorId,
          })
          .from(s.moradorContatos)
          .innerJoin(s.condominios, eq(s.condominios.id, s.moradorContatos.condominioId))
          .where(eq(s.moradorContatos.phoneE164, telefone));
        const opcoes = meus.length
          ? meus
          : (
              await t
                .select({ condominioId: s.condominios.id, nome: s.condominios.nome })
                .from(s.condominios)
            ).map((c) => ({ ...c, moradorId: null as string | null }));
        const achou = escolherCondominio(condominio, opcoes);
        if (!achou)
          return `Não encontrei esse condomínio. Opções: ${opcoes.map((o) => o.nome).join("; ")}.`;
        if (achou.condominioId === condominioId) return `A conversa já é do ${achou.nome}.`;
        await t
          .update(s.conversas)
          .set({ condominioId: achou.condominioId, moradorId: achou.moradorId })
          .where(eq(s.conversas.id, ctx.conversa.id));
        efeitos.trocouCondominio = true;
        return `Condomínio trocado para ${achou.nome}. Não responda mais nada agora: a conversa recomeça com os documentos dele.`;
      }),
  });

  const identificar_morador = betaZodTool({
    name: "identificar_morador",
    description:
      "Mostra quem é o morador desta conversa (nome, unidade, situação do cadastro). Só os dados dele mesmo.",
    inputSchema: z.object({}),
    run: async () => {
      if (!ctx.conversa.moradorId)
        return "Número sem cadastro neste condomínio. Se o morador quiser, faça o cadastro com registrar_cadastro.";
      const [m] = await tx((t) =>
        t
          .select({ m: s.moradores, u: s.unidades })
          .from(s.moradores)
          .leftJoin(s.unidades, eq(s.unidades.id, s.moradores.unidadeId))
          .where(eq(s.moradores.id, ctx.conversa.moradorId!)),
      );
      if (!m) return "Cadastro não encontrado.";
      const u = m.u;
      const unidade = u
        ? [
            u.bloco && `Bloco ${u.bloco}`,
            u.apto && `Apto ${u.apto}`,
            u.quadra && `Quadra ${u.quadra}`,
            u.casa && `Casa ${u.casa}`,
          ]
            .filter(Boolean)
            .join(", ")
        : (m.m.unidadeInformada ?? "não informada");
      return `Nome: ${m.m.nome}. Unidade: ${unidade}. Cadastro: ${m.m.cadastro}${m.m.cadastro === "pendente" ? " (aguarda aprovação do síndico)" : ""}.`;
    },
  });

  const registrar_cadastro = betaZodTool({
    name: "registrar_cadastro",
    description: `Cadastra o morador de um número desconhecido, como PENDENTE (o síndico aprova). Antes, pergunte nome, unidade, vínculo e peça o aceite exatamente com este texto: "${LGPD_TEXTO}". Só chame com o aceite dado.`,
    inputSchema: z.object({
      nome: z.string().min(3).max(120),
      unidade: z
        .string()
        .min(1)
        .max(80)
        .describe("Como o morador escreveu, ex.: 'Bloco B, apto 302'"),
      vinculo: z.enum(["proprietario", "locatario", "residente"]),
      aceite_lgpd: z.literal(true).describe("true somente se o morador aceitou o texto da LGPD"),
    }),
    run: async ({ nome, unidade, vinculo }) => {
      if (ctx.conversa.moradorId) return "Este número já tem cadastro neste condomínio.";
      return tx(async (t) => {
        const unidades = await t
          .select()
          .from(s.unidades)
          .where(eq(s.unidades.condominioId, condominioId));
        const u = acharUnidade(unidade, unidades);
        // Sempre pendente: só o síndico aprova (nunca o modelo).
        const [m] = await t
          .insert(s.moradores)
          .values({
            tenantId,
            condominioId,
            nome,
            unidadeId: u?.id ?? null,
            unidadeInformada: unidade,
            status: vinculo,
            cadastro: "pendente",
          })
          .returning({ id: s.moradores.id });
        await t
          .insert(s.moradorContatos)
          .values({ tenantId, moradorId: m!.id, condominioId, phoneE164: telefone })
          .onConflictDoNothing();
        await t.insert(s.consentimentos).values({
          tenantId,
          phoneE164: telefone,
          finalidade: "atendimento_whatsapp",
          textoVersao: LGPD_VERSAO,
        });
        await t
          .update(s.conversas)
          .set({ moradorId: m!.id })
          .where(and(eq(s.conversas.id, ctx.conversa.id), isNull(s.conversas.moradorId)));
        ctx.conversa.moradorId = m!.id;
        return "Cadastro registrado como pendente. Avise que o síndico vai conferir; até lá, só regras gerais e abertura de demandas.";
      });
    },
  });

  const abrir_demanda = betaZodTool({
    name: "abrir_demanda",
    description:
      "Abre uma demanda para a administração (manutenção, segurança, limpeza, administrativo). Use quando o morador relatar um problema ou pedir um serviço. Abre na hora; avise o código ao morador.",
    inputSchema: z.object({
      titulo: z.string().min(4).max(120),
      descricao: z.string().min(10).max(1200).describe("O que o morador relatou, com detalhes"),
      categoria: z.enum(["manutencao", "seguranca", "limpeza", "administrativo"]),
      prioridade: z
        .enum(["normal", "alta", "critica"])
        .describe("critica: risco a pessoas; alta: dano em andamento; normal: o resto"),
      local: z.string().max(120).optional(),
      custo_estimado: z
        .number()
        .min(0)
        .optional()
        .describe("Só se o morador informou um valor ou orçamento"),
    }),
    run: async (d) =>
      tx(async (t) => {
        const [m] = ctx.conversa.moradorId
          ? await t
              .select({ unidadeId: s.moradores.unidadeId })
              .from(s.moradores)
              .where(eq(s.moradores.id, ctx.conversa.moradorId))
          : [];
        const limite = ctx.config.limiteAprovacao;
        const acimaLimite = d.custo_estimado != null && limite != null && d.custo_estimado > limite;
        const codigo = await proximoCodigoDemanda(t);
        const [nova] = await t
          .insert(s.demandas)
          .values({
            tenantId,
            codigo,
            condominioId,
            moradorId: ctx.conversa.moradorId,
            unidadeId: m?.unidadeId ?? null,
            conversaId: ctx.conversa.id,
            titulo: d.titulo,
            descricao: d.descricao,
            local: d.local,
            categoria: d.categoria,
            prioridade: d.prioridade,
            // Acima do limite de aprovação: vai para análise do síndico, não para execução.
            coluna: acimaLimite ? "triagem" : "novas",
            slaAte: new Date(Date.now() + SLA_HORAS[PRIO_TELA[d.prioridade]] * 3_600_000),
            custoEstimado: d.custo_estimado ?? null,
          })
          .returning({ id: s.demandas.id });
        await t.insert(s.demandaEventos).values([
          {
            tenantId,
            demandaId: nova!.id,
            ator: "Concierge IA",
            acao: "Abriu a demanda pelo WhatsApp",
            canal: "ia",
          },
          ...(acimaLimite
            ? [
                {
                  tenantId,
                  demandaId: nova!.id,
                  ator: "Concierge IA",
                  acao: "Aguarda aprovação do síndico",
                  detalhe: `Custo estimado acima do limite de aprovação (R$ ${limite}).`,
                  canal: "ia" as const,
                },
              ]
            : []),
        ]);
        return `Demanda ${codigo} aberta${acimaLimite ? " e enviada para aprovação do síndico (valor acima do limite)" : ""}.`;
      }),
  });

  const minhas_demandas = betaZodTool({
    name: "minhas_demandas",
    description:
      "Lista as demandas do próprio morador (abertas e as 5 últimas resolvidas). Só para cadastro aprovado.",
    inputSchema: z.object({}),
    run: async () => {
      if (!aprovado || !ctx.conversa.moradorId)
        return "Só moradores com cadastro aprovado podem consultar as próprias demandas.";
      const ds = await tx((t) =>
        t
          .select()
          .from(s.demandas)
          .where(eq(s.demandas.moradorId, ctx.conversa.moradorId!))
          .orderBy(desc(s.demandas.atualizadoEm))
          .limit(15),
      );
      const abertas = ds.filter((x) => x.coluna !== "resolvidas");
      const lista = [...abertas, ...ds.filter((x) => x.coluna === "resolvidas").slice(0, 5)];
      if (!lista.length) return "O morador não tem demandas.";
      return lista.map((x) => `${x.codigo}: ${x.titulo} (${COLUNA_TEXTO[x.coluna]})`).join("\n");
    },
  });

  const atualizar_demanda = betaZodTool({
    name: "atualizar_demanda",
    description:
      "Acrescenta uma informação do morador a uma demanda dele que ainda não foi resolvida. Só para cadastro aprovado.",
    inputSchema: z.object({
      codigo: z
        .string()
        .regex(/^D-\d+$/)
        .describe("Ex.: D-2405"),
      comentario: z.string().min(3).max(1200),
    }),
    run: async ({ codigo, comentario }) => {
      if (!aprovado || !ctx.conversa.moradorId)
        return "Só moradores com cadastro aprovado podem atualizar demandas.";
      return tx(async (t) => {
        const [d] = await t
          .select({ id: s.demandas.id })
          .from(s.demandas)
          .where(
            and(
              eq(s.demandas.codigo, codigo),
              eq(s.demandas.moradorId, ctx.conversa.moradorId!),
              ne(s.demandas.coluna, "resolvidas"),
            ),
          );
        if (!d) return `Não achei a demanda ${codigo} aberta deste morador.`;
        await t.insert(s.demandaEventos).values({
          tenantId,
          demandaId: d.id,
          ator: ctx.morador?.nome ?? "Morador",
          acao: "Comentou pelo WhatsApp",
          detalhe: comentario,
          canal: "whatsapp",
        });
        await t
          .update(s.demandas)
          .set({ atualizadoEm: sql`now()` })
          .where(eq(s.demandas.id, d.id));
        return `Comentário registrado na ${codigo}.`;
      });
    },
  });

  const escalar_sindico = betaZodTool({
    name: "escalar_sindico",
    description:
      "Passa a conversa para o síndico (reclamação entre vizinhos, pedido de exceção, assunto sensível, morador pediu para falar com o síndico). Depois avise o morador que o síndico responde por aqui.",
    inputSchema: z.object({ motivo: z.string().min(3).max(300) }),
    run: async ({ motivo }) => {
      efeitos.escalar = motivo;
      return "Conversa será passada ao síndico. Escreva ao morador uma mensagem curta avisando.";
    },
  });

  return [
    buscar_regras,
    definir_condominio,
    identificar_morador,
    registrar_cadastro,
    abrir_demanda,
    minhas_demandas,
    atualizar_demanda,
    escalar_sindico,
  ];
}
