/**
 * Contexto de uma resposta do agente, sempre a partir da conversa (nunca do modelo):
 * condomínio, morador, configuração, documentos visíveis e histórico.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ConfigAgente } from "@/lib/agente.functions";
import { schema as s, type Tx } from "@/server/db";

export const COLECAO_NOME: Record<(typeof s.colecao.enumValues)[number], string> = {
  convencao: "Convenção",
  estatuto: "Estatuto",
  regimento: "Regimento Interno",
  ata: "Ata de assembleia",
  procedimento: "Procedimento",
  comunicado: "Comunicado",
  manual: "Manual técnico",
};
// Prevalência: Convenção > Estatuto > Regimento > Ata (a mais recente primeiro) > demais.
const ORDEM = ["convencao", "estatuto", "regimento", "ata", "procedimento", "comunicado", "manual"];

/**
 * Teto de texto dos documentos no prompt (~70 mil tokens): abaixo dos 100 mil em que o preço do
 * Haiku dobra. ponytail: o que passar disso fica de fora (atas mais antigas primeiro); a busca
 * nas atas (Fase 6) resolve condomínios com muitos documentos.
 */
const TETO_CARACTERES = 250_000;
/** Mensagens da conversa enviadas ao modelo. */
const HISTORICO = 30;

export interface DocContexto {
  id: string;
  titulo: string;
  colecao: (typeof s.colecao.enumValues)[number];
  vigenteDesde: string | null;
  revogaTitulo: string | null;
  trechos: { referencia: string | null; texto: string }[];
}

export interface Contexto {
  conversa: typeof s.conversas.$inferSelect;
  condominio: string;
  morador: { nome: string; cadastro: "pendente" | "aprovado" | "recusado" } | null;
  config: ConfigAgente;
  instrucoes: string | null;
  documentos: DocContexto[];
  historico: (typeof s.mensagens.$inferSelect)[];
}

export async function carregarContexto(tx: Tx, conversaId: string): Promise<Contexto | null> {
  const [linha] = await tx
    .select({ conversa: s.conversas, condominio: s.condominios.nome, morador: s.moradores })
    .from(s.conversas)
    .innerJoin(s.condominios, eq(s.condominios.id, s.conversas.condominioId))
    .leftJoin(s.moradores, eq(s.moradores.id, s.conversas.moradorId))
    .where(eq(s.conversas.id, conversaId));
  if (!linha) return null; // sem condomínio definido o agente não responde
  const condominioId = linha.conversa.condominioId!;

  const [cfg] = await tx
    .select()
    .from(s.agenteConfig)
    .where(eq(s.agenteConfig.condominioId, condominioId));
  const config = ConfigAgente.safeParse(cfg ?? {});

  // Morador aprovado vê o que é dos moradores; pendente ou desconhecido, só o público.
  // Interno e conselho nunca vão para o WhatsApp.
  const visiveis: (typeof s.visibilidade.enumValues)[number][] =
    linha.morador?.cadastro === "aprovado" ? ["publico", "moradores"] : ["publico"];
  const docs = await tx
    .select()
    .from(s.documentos)
    .where(
      and(
        eq(s.documentos.condominioId, condominioId),
        inArray(s.documentos.status, ["treinado", "revisao"]),
        inArray(s.documentos.visibilidade, visiveis),
      ),
    )
    .orderBy(desc(s.documentos.vigenteDesde), desc(s.documentos.criadoEm));
  docs.sort((a, b) => ORDEM.indexOf(a.colecao) - ORDEM.indexOf(b.colecao));
  const trechos = docs.length
    ? await tx
        .select()
        .from(s.documentoTrechos)
        .where(
          inArray(
            s.documentoTrechos.documentoId,
            docs.map((d) => d.id),
          ),
        )
        .orderBy(asc(s.documentoTrechos.ordem))
    : [];

  const documentos: DocContexto[] = [];
  let total = 0;
  for (const d of docs) {
    const ts = trechos.filter((t) => t.documentoId === d.id);
    const tamanho = ts.reduce((n, t) => n + t.texto.length, 0);
    if (!ts.length || total + tamanho > TETO_CARACTERES) continue;
    total += tamanho;
    documentos.push({
      id: d.id,
      titulo: d.titulo,
      colecao: d.colecao,
      vigenteDesde: d.vigenteDesde,
      revogaTitulo: docs.find((x) => x.id === d.revogaDocumentoId)?.titulo ?? null,
      trechos: ts.map((t) => ({ referencia: t.referencia, texto: t.texto })),
    });
  }

  const historico = (
    await tx
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.conversaId, conversaId))
      .orderBy(desc(s.mensagens.criadoEm), desc(s.mensagens.direcao))
      .limit(HISTORICO)
  ).reverse();

  return {
    conversa: linha.conversa,
    condominio: linha.condominio,
    morador: linha.morador ? { nome: linha.morador.nome, cadastro: linha.morador.cadastro } : null,
    config: config.success ? config.data : ConfigAgente.parse({}),
    instrucoes: cfg?.instrucoes ?? null,
    documentos,
    historico,
  };
}
