/**
 * Demandas no banco: kanban, detalhe, abertura pelo painel, resolver, assumir e anexos (S3).
 * Cliente sempre da sessão (exigirCliente) + withTenant; o código (D-2401) é a chave na URL.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type {
  Attachment,
  Category,
  ColumnId,
  Demanda,
  Message,
  Priority,
  TimelineEvent,
} from "@/data/demandas";
import { formatarTelefone } from "@/lib/telefone";
import { gravarArquivo, linkTemporario, nomeSeguro } from "@/server/arquivos";
import { exigirCliente } from "@/server/auth/contexto";
import { type Tx, schema as s, withTenant } from "@/server/db";

/* ------------------------------------------------------------ conversões */

const PRIO_DB = { Crítica: "critica", Alta: "alta", Normal: "normal" } as const;
export const PRIO_TELA = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
} as const satisfies Record<string, Priority>;
const CAT_DB = {
  Manutenção: "manutencao",
  Segurança: "seguranca",
  Limpeza: "limpeza",
  Administrativo: "administrativo",
} as const;
const CAT_TELA = {
  manutencao: "Manutenção",
  seguranca: "Segurança",
  limpeza: "Limpeza",
  administrativo: "Administrativo",
} as const satisfies Record<string, Category>;
const CANAL_TELA = {
  whatsapp: "WhatsApp",
  portal: "Portal",
  portaria: "Portaria",
  ia: "IA",
  sistema: "Sistema",
} as const satisfies Record<string, NonNullable<TimelineEvent["channel"]>>;
const AUTOR_TELA = {
  morador: "morador",
  ia: "ia",
  sindico: "sindico",
  sistema: "ia",
} as const satisfies Record<string, Message["from"]>;

/** Prazo da demanda aberta pelo painel (mesma tabela mostrada na tela "Nova demanda"). */
export const SLA_HORAS: Record<Priority, number> = { Crítica: 2, Alta: 6, Normal: 24 };

const TZ = "America/Sao_Paulo";
const hora = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: TZ });

function quando(d: Date): string {
  const hoje = dia(d) === dia(new Date());
  return hoje ? hora(d) : `${dia(d).slice(0, 5)} ${hora(d)}`;
}

function idade(d: Date): string {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  const dias = Math.round(min / (24 * 60));
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

function prazo(slaAte: Date | null, coluna: ColumnId): string | undefined {
  if (!slaAte || coluna === "resolvidas") return undefined;
  const h = Math.ceil((slaAte.getTime() - Date.now()) / 3_600_000);
  return h <= 0 ? "SLA vencido" : `SLA ${h}h`;
}

export function unidadeTexto(u: typeof s.unidades.$inferSelect | null): string {
  if (!u) return "Áreas comuns";
  return u.quadra != null ? `Casa ${u.casa ?? ""}` : `Apto ${u.apto ?? ""}`;
}

/* ------------------------------------------------------------ leitura */

async function carregar(tx: Tx, filtro?: { codigo: string }): Promise<Demanda[]> {
  const responsavel = sql<
    string | null
  >`(select u.name from membros mb join "user" u on u.id = mb.user_id
    where mb.id = ${s.demandas.responsavelId})`;
  const fone = sql<string | null>`(select c.phone_e164 from morador_contatos c
    where c.morador_id = ${s.demandas.moradorId} order by c.principal desc limit 1)`;
  const linhas = await tx
    .select({ d: s.demandas, m: s.moradores, u: s.unidades, responsavel, fone })
    .from(s.demandas)
    .leftJoin(s.moradores, eq(s.moradores.id, s.demandas.moradorId))
    .leftJoin(s.unidades, eq(s.unidades.id, s.demandas.unidadeId))
    .where(filtro ? eq(s.demandas.codigo, filtro.codigo) : undefined)
    .orderBy(desc(s.demandas.criadoEm));
  if (!linhas.length) return [];

  const ids = linhas.map((l) => l.d.id);
  const anexos = await tx
    .select()
    .from(s.demandaAnexos)
    .where(inArray(s.demandaAnexos.demandaId, ids))
    .orderBy(asc(s.demandaAnexos.criadoEm));
  // Linha do tempo e conversa só no detalhe (a lista não mostra).
  const eventos = filtro
    ? await tx
        .select()
        .from(s.demandaEventos)
        .where(inArray(s.demandaEventos.demandaId, ids))
        .orderBy(asc(s.demandaEventos.em))
    : [];
  const conversaId = filtro ? linhas[0].d.conversaId : null;
  const mensagens = conversaId
    ? await tx
        .select()
        .from(s.mensagens)
        .where(eq(s.mensagens.conversaId, conversaId))
        .orderBy(asc(s.mensagens.criadoEm))
    : [];

  return Promise.all(
    linhas.map(async ({ d, m, u, responsavel, fone }) => ({
      id: d.codigo,
      title: d.titulo,
      description: d.descricao ?? "",
      morador: m?.nome ?? "Condomínio",
      moradorId: m?.id,
      unit: unidadeTexto(u),
      priority: PRIO_TELA[d.prioridade],
      category: CAT_TELA[d.categoria],
      age: idade(d.criadoEm),
      createdAt: `${dia(d.criadoEm) === dia(new Date()) ? "Hoje" : dia(d.criadoEm)}, ${hora(d.criadoEm)}`,
      sla: prazo(d.slaAte, d.coluna),
      assigned: responsavel ?? undefined,
      // ponytail: "assumir" = virar responsável; o controle da conversa no WhatsApp chega com o agente.
      assumedBy: responsavel ?? undefined,
      column: d.coluna,
      location: d.local ?? "",
      contact: { phone: formatarTelefone(fone), email: m?.email ?? "" },
      attachments: await Promise.all(
        anexos
          .filter((a) => a.demandaId === d.id)
          .map(
            async (a): Promise<Attachment> => ({
              name: a.nome,
              size: tamanho(a.tamanhoBytes),
              kind: a.tipo,
              url: filtro ? await linkTemporario(a.storagePath, a.nome) : undefined,
            }),
          ),
      ),
      timeline: eventos
        .filter((e) => e.demandaId === d.id)
        .map((e) => ({
          at: quando(e.em),
          actor: e.ator,
          action: e.acao,
          detail: e.detalhe ?? undefined,
          channel: CANAL_TELA[e.canal],
        })),
      messages: mensagens.map((x) => ({
        at: quando(x.criadoEm),
        from: AUTOR_TELA[x.autor],
        author:
          x.autor === "morador"
            ? (m?.nome ?? "Morador")
            : x.autor === "ia"
              ? "Concierge IA"
              : "Síndico",
        text: x.texto ?? x.transcricao ?? "",
      })),
      cost:
        d.custoEstimado != null || d.custoAprovado != null
          ? { estimated: Number(d.custoEstimado ?? 0), approved: d.custoAprovado ?? undefined }
          : undefined,
    })),
  );
}

function tamanho(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const listarDemandas = createServerFn({ method: "GET" }).handler(
  async (): Promise<Demanda[]> => {
    const { tenantId } = await exigirCliente();
    // ponytail: devolve todas; paginar quando um cliente passar de alguns milhares.
    return withTenant(tenantId, (tx) => carregar(tx));
  },
);

const Codigo = z.object({ codigo: z.string().regex(/^D-\d+$/) });

export const obterDemanda = createServerFn({ method: "GET" })
  .inputValidator(Codigo)
  .handler(async ({ data }): Promise<Demanda | null> => {
    const { tenantId } = await exigirCliente();
    const [d] = await withTenant(tenantId, (tx) => carregar(tx, data));
    return d ?? null;
  });

/* ------------------------------------------------------------ gravação */

/**
 * Próximo código do cliente (D-2401…). Usado pelo painel e pelo agente.
 * ponytail: duas aberturas no mesmo instante → a 2ª falha no unique(tenant_id, codigo); trocar
 * por sequência por cliente se acontecer de verdade.
 */
export async function proximoCodigoDemanda(tx: Tx): Promise<string> {
  const [{ n }] = (
    await tx.execute<{ n: number }>(
      sql`select coalesce(max(substring(codigo from 3)::int), 2400) + 1 as n from demandas`,
    )
  ).rows;
  return `D-${n}`;
}

async function idDa(tx: Tx, codigo: string) {
  const [d] = await tx
    .select({
      id: s.demandas.id,
      coluna: s.demandas.coluna,
      responsavelId: s.demandas.responsavelId,
      condominioId: s.demandas.condominioId,
    })
    .from(s.demandas)
    .where(eq(s.demandas.codigo, codigo));
  if (!d) throw new Error("Demanda não encontrada.");
  return d;
}

const NovaDemanda = z.object({
  titulo: z.string().trim().min(4).max(120),
  descricao: z.string().trim().min(10).max(1200),
  categoria: z.enum(["Manutenção", "Segurança", "Limpeza", "Administrativo"]),
  prioridade: z.enum(["Crítica", "Alta", "Normal"]),
  condominioId: z.string().uuid(),
  moradorId: z.string().uuid(),
  local: z.string().trim().min(3).max(120),
  canal: z.enum(["WhatsApp", "Portal", "Portaria", "E-mail"]),
  custoEstimado: z.number().min(0),
});

export const criarDemanda = createServerFn({ method: "POST" })
  .inputValidator(NovaDemanda)
  .handler(async ({ data }) => {
    const ctx = await exigirCliente();
    return withTenant(ctx.tenantId, async (tx) => {
      const [m] = await tx
        .select({ unidadeId: s.moradores.unidadeId })
        .from(s.moradores)
        .where(
          and(eq(s.moradores.id, data.moradorId), eq(s.moradores.condominioId, data.condominioId)),
        );
      if (!m) throw new Error("Morador não encontrado neste condomínio.");
      const codigo = await proximoCodigoDemanda(tx);
      const [d] = await tx
        .insert(s.demandas)
        .values({
          tenantId: ctx.tenantId,
          codigo,
          condominioId: data.condominioId,
          moradorId: data.moradorId,
          unidadeId: m.unidadeId,
          titulo: data.titulo,
          descricao: data.descricao,
          local: data.local,
          categoria: CAT_DB[data.categoria],
          prioridade: PRIO_DB[data.prioridade],
          slaAte: new Date(Date.now() + SLA_HORAS[data.prioridade] * 3_600_000),
          custoEstimado: data.custoEstimado || null,
        })
        .returning({ id: s.demandas.id });
      const canal = {
        WhatsApp: "whatsapp",
        Portal: "portal",
        Portaria: "portaria",
        "E-mail": "portal",
      } as const;
      await tx.insert(s.demandaEventos).values({
        tenantId: ctx.tenantId,
        demandaId: d.id,
        ator: ctx.nome,
        acao: `Abriu a demanda pelo painel (recebida via ${data.canal})`,
        canal: canal[data.canal],
      });
      return { codigo };
    });
  });

export const resolverDemanda = createServerFn({ method: "POST" })
  .inputValidator(Codigo)
  .handler(async ({ data }) => {
    const ctx = await exigirCliente();
    await withTenant(ctx.tenantId, async (tx) => {
      const d = await idDa(tx, data.codigo);
      if (d.coluna === "resolvidas") return;
      await tx
        .update(s.demandas)
        .set({ coluna: "resolvidas", atualizadoEm: new Date() })
        .where(eq(s.demandas.id, d.id));
      await tx.insert(s.demandaEventos).values({
        tenantId: ctx.tenantId,
        demandaId: d.id,
        ator: ctx.nome,
        acao: "Marcou a demanda como resolvida",
      });
    });
  });

export const assumirDemanda = createServerFn({ method: "POST" })
  .inputValidator(Codigo)
  .handler(async ({ data }) => {
    const ctx = await exigirCliente();
    if (!ctx.membroId) throw new Error("Usuário sem cliente vinculado.");
    await withTenant(ctx.tenantId, async (tx) => {
      const d = await idDa(tx, data.codigo);
      if (d.responsavelId === ctx.membroId) return;
      await tx
        .update(s.demandas)
        .set({ responsavelId: ctx.membroId, atualizadoEm: new Date() })
        .where(eq(s.demandas.id, d.id));
      await tx.insert(s.demandaEventos).values({
        tenantId: ctx.tenantId,
        demandaId: d.id,
        ator: ctx.nome,
        acao: "Assumiu a demanda",
      });
    });
  });

const LIMITE_ANEXO = 20 * 1024 * 1024;

function tipoDoArquivo(f: File): "image" | "pdf" | "video" | null {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return null;
}

/** Recebe FormData com `codigo` e um ou mais `arquivos`. */
export const anexarArquivos = createServerFn({ method: "POST" })
  .inputValidator((fd: unknown) => {
    if (!(fd instanceof FormData)) throw new Error("Envio inválido.");
    const { codigo } = Codigo.parse({ codigo: fd.get("codigo") });
    const arquivos = fd.getAll("arquivos").filter((f): f is File => f instanceof File);
    if (!arquivos.length) throw new Error("Nenhum arquivo enviado.");
    for (const f of arquivos) {
      if (f.size > LIMITE_ANEXO) throw new Error(`${f.name}: maior que 20 MB.`);
      if (!tipoDoArquivo(f)) throw new Error(`${f.name}: só imagem, vídeo ou PDF.`);
    }
    return { codigo, arquivos };
  })
  .handler(async ({ data }) => {
    const ctx = await exigirCliente();
    await withTenant(ctx.tenantId, async (tx) => {
      const d = await idDa(tx, data.codigo);
      for (const f of data.arquivos) {
        const caminho = `${ctx.tenantId}/${d.condominioId}/demandas/${d.id}/${crypto.randomUUID()}-${nomeSeguro(f.name)}`;
        // Grava no S3 antes da linha: se o banco falhar, sobra um arquivo órfão, nunca uma
        // linha apontando para o nada.
        await gravarArquivo(
          caminho,
          new Uint8Array(await f.arrayBuffer()),
          f.type || "application/octet-stream",
        );
        await tx.insert(s.demandaAnexos).values({
          tenantId: ctx.tenantId,
          demandaId: d.id,
          nome: f.name,
          tipo: tipoDoArquivo(f)!,
          storagePath: caminho,
          tamanhoBytes: f.size,
        });
      }
      const n = data.arquivos.length;
      await tx.insert(s.demandaEventos).values({
        tenantId: ctx.tenantId,
        demandaId: d.id,
        ator: ctx.nome,
        acao: `Anexou ${n} ${n === 1 ? "arquivo" : "arquivos"}`,
      });
    });
  });
