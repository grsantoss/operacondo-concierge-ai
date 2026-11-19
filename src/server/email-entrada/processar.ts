/**
 * Job da fila "email" (#79): baixa o e-mail bruto do bucket da SES, descarta respostas
 * automáticas e loops, limpa o texto e grava conversa (canal e-mail), mensagem e anexos no S3
 * do cliente. Roteamento (#80): o remetente identifica o morador e o condomínio só com DKIM ou
 * DMARC aprovados (o remetente de e-mail pode ser forjado); urgência pelas regras fixas no assunto
 * e no corpo; com o condomínio definido e IA configurada, o agente escreve o rascunho.
 * CPF e telefone são mascarados antes do Claude, como no WhatsApp (`agent/prompt.ts`).
 * Roda como oc_admin (a entrada é só da plataforma): toda consulta filtra o cliente.
 */
import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import PostalMime from "postal-mime";
import { gravarArquivo, nomeSeguro } from "@/server/arquivos";
import { dbAdmin, schema as s } from "@/server/db";
import { CONFIRMACAO_GMAIL, motivoIgnorar, textoDoEmail } from "@/server/email-entrada/limpar";
import { iaConfigurada } from "@/server/llm";
import { detectarUrgencia } from "@/server/pipeline/regras-urgencia";
import { subirUrgencia } from "@/server/pipeline/roteamento";
import type { JobAgente, JobAlerta } from "@/server/queue";

type TxAdmin = Parameters<Parameters<ReturnType<typeof dbAdmin>["transaction"]>[0]>[0];

/**
 * Condomínio e morador do remetente. Autenticado (DKIM ou DMARC): pelo `moradores.email`, se
 * apontar para um condomínio só. Senão, desconhecido (só regras públicas); o condomínio fica
 * definido apenas se o cliente tiver um só.
 */
export async function identificarRemetente(
  tx: TxAdmin,
  tenantId: string,
  remetente: string,
  autenticado: boolean,
): Promise<{ condominioId: string | null; moradorId: string | null }> {
  const vinculos = autenticado
    ? await tx
        .select({ id: s.moradores.id, condominioId: s.moradores.condominioId })
        .from(s.moradores)
        .where(
          and(
            eq(s.moradores.tenantId, tenantId),
            sql`lower(${s.moradores.email}) = ${remetente}`,
            isNull(s.moradores.desativadoEm),
            ne(s.moradores.cadastro, "recusado"),
          ),
        )
    : [];
  const condos = [...new Set(vinculos.map((v) => v.condominioId))];
  if (condos.length === 1)
    return { condominioId: condos[0]!, moradorId: vinculos.length === 1 ? vinculos[0]!.id : null };
  if (condos.length > 1) return { condominioId: null, moradorId: null };
  const todos = await tx
    .select({ id: s.condominios.id })
    .from(s.condominios)
    .where(eq(s.condominios.tenantId, tenantId))
    .orderBy(asc(s.condominios.nome))
    .limit(2);
  return { condominioId: todos.length === 1 ? todos[0]!.id : null, moradorId: null };
}

export interface ResultadoEmail {
  conversaId: string | null;
  ignorado: string | null;
  alerta: JobAlerta | null;
  agente: JobAgente | null;
}

/** Anexo acima disso não é guardado (a SES aceita até 40 MB por e-mail). */
const LIMITE_ANEXO = 20 * 1024 * 1024;

export interface Bruto {
  ler(chave: string): Promise<Uint8Array>;
  apagar(chave: string): Promise<void>;
}

let cliente: S3Client | null = null;
function s3Ses() {
  const id = process.env.SES_ACCESS_KEY;
  cliente ??= new S3Client({
    region: process.env.SES_REGION || "sa-east-1",
    ...(id
      ? { credentials: { accessKeyId: id, secretAccessKey: process.env.SES_SECRET_KEY ?? "" } }
      : {}),
  });
  return cliente;
}
const partes = (chave: string) => {
  const i = chave.indexOf("/");
  return { Bucket: chave.slice(0, i), Key: chave.slice(i + 1) };
};

/** Bucket da SES (na AWS, fora do S3 do projeto). */
export const brutoSes: Bruto = {
  async ler(chave) {
    const r = await s3Ses().send(new GetObjectCommand(partes(chave)));
    return r.Body!.transformToByteArray();
  },
  async apagar(chave) {
    await s3Ses().send(new DeleteObjectCommand(partes(chave)));
  },
};

/** Endereços e domínios do próprio Concierge (o que enviamos não pode voltar como pergunta). */
function proprios(canal: string): string[] {
  const remetente =
    (process.env.SES_REMETENTE ?? "").match(/<([^>]+)>/)?.[1] ?? process.env.SES_REMETENTE;
  return [canal, canal.split("@")[1], process.env.EMAIL_DOMINIO, remetente]
    .filter((x): x is string => !!x)
    .map((x) => x.trim().toLowerCase());
}

const extensao = (nome: string | null, mime: string) =>
  nome?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() ??
  (mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin");

export async function processarEmail(
  entradaId: string,
  bruto: Bruto = brutoSes,
  gravar: typeof gravarArquivo = gravarArquivo,
): Promise<ResultadoEmail> {
  const r = await dbAdmin().transaction(async (tx) => {
    const [e] = await tx
      .select({ entrada: s.emailEntradas, canal: s.emailCanais })
      .from(s.emailEntradas)
      .innerJoin(s.emailCanais, eq(s.emailCanais.id, s.emailEntradas.emailCanalId))
      .where(and(eq(s.emailEntradas.id, entradaId), isNull(s.emailEntradas.processadoEm)))
      .for("update", { of: s.emailEntradas, skipLocked: true });
    if (!e) return null;
    const { entrada, canal } = e;
    const raw = await bruto.ler(entrada.s3Chave);
    const email = await PostalMime.parse(raw);
    const remetente = (email.from?.address ?? "").trim().toLowerCase();
    const feito = (campos: Partial<typeof s.emailEntradas.$inferInsert>) =>
      tx
        .update(s.emailEntradas)
        .set({ processadoEm: new Date(), ...campos })
        .where(eq(s.emailEntradas.id, entrada.id));

    const ignorado = !remetente.includes("@")
      ? "sem remetente"
      : entrada.autenticacao.virus === "FAIL"
        ? "vírus"
        : motivoIgnorar(email, remetente, proprios(canal.endereco));
    if (ignorado) {
      await feito({ ignorado });
      return { chave: entrada.s3Chave, conversaId: null, ignorado };
    }

    const tenantId = entrada.tenantId;
    const comIa = iaConfigurada();
    let [conversa] = await tx
      .select()
      .from(s.conversas)
      .where(
        and(
          eq(s.conversas.tenantId, tenantId),
          eq(s.conversas.emailCanalId, canal.id),
          eq(s.conversas.endereco, remetente),
          ne(s.conversas.estado, "resolvida"),
        ),
      )
      .orderBy(desc(s.conversas.criadoEm))
      .limit(1);
    // ponytail: uma conversa aberta por remetente (como no WhatsApp); juntar pela thread
    // (In-Reply-To/References) se o mesmo morador abrir assuntos paralelos.
    if (!conversa) {
      const autenticado =
        entrada.autenticacao.dkim === "PASS" || entrada.autenticacao.dmarc === "PASS";
      const quem = await identificarRemetente(tx, tenantId, remetente, autenticado);
      const gmail = remetente === CONFIRMACAO_GMAIL;
      // Sem condomínio definido (vários e remetente desconhecido) o agente não responde: o
      // síndico vê a conversa e define.
      conversa = (
        await tx
          .insert(s.conversas)
          .values({
            tenantId,
            canal: "email",
            emailCanalId: canal.id,
            endereco: remetente,
            ...quem,
            estado: comIa && quem.condominioId && !gmail ? "ia" : "aguardando_sindico",
            rascunhoMotivo: gmail ? "Confirmação de encaminhamento do Gmail" : null,
          })
          .returning()
      )[0]!;
    }
    await tx
      .update(s.conversas)
      .set({ ultimaMsgEm: new Date() })
      .where(eq(s.conversas.id, conversa.id));

    const pasta = `${tenantId}/${conversa.condominioId ?? "sem-condominio"}/email/${conversa.id}`;
    const [msg] = await tx
      .insert(s.mensagens)
      .values({
        tenantId,
        conversaId: conversa.id,
        direcao: "entrada",
        autor: "morador",
        tipo: "texto",
        texto: textoDoEmail(email) || null,
        assunto: email.subject?.trim() || null,
        messageId: email.messageId ?? entrada.messageId,
        inReplyTo: email.inReplyTo ?? null,
      })
      .returning({ id: s.mensagens.id });

    // Anexos de verdade (imagem embutida no corpo, como logo de assinatura, fica de fora).
    for (const a of email.attachments) {
      if (a.related || (a.disposition !== "attachment" && !a.filename)) continue;
      const bytes =
        typeof a.content === "string"
          ? new TextEncoder().encode(a.content)
          : new Uint8Array(a.content as ArrayBuffer);
      if (bytes.byteLength > LIMITE_ANEXO) continue;
      const [m] = await tx
        .insert(s.mensagens)
        .values({
          tenantId,
          conversaId: conversa.id,
          direcao: "entrada",
          autor: "morador",
          tipo: a.mimeType.startsWith("image/") ? "imagem" : "documento",
          texto: a.filename ? nomeSeguro(a.filename) : null,
        })
        .returning({ id: s.mensagens.id });
      const caminho = `${pasta}/${m!.id}.${extensao(a.filename, a.mimeType)}`;
      await gravar(caminho, bytes, a.mimeType);
      await tx.update(s.mensagens).set({ midiaPath: caminho }).where(eq(s.mensagens.id, m!.id));
    }

    const original = `${pasta}/${msg!.id}.eml`;
    await gravar(original, raw, "message/rfc822");
    await feito({ originalPath: original, mensagemId: msg!.id });
    await tx
      .update(s.emailCanais)
      .set({ status: "conectado", verificadoEm: new Date() })
      .where(eq(s.emailCanais.id, canal.id));

    // Regras fixas de urgência no assunto e no corpo (independem da IA e do condomínio).
    const regra = detectarUrgencia(`${email.subject ?? ""}\n${textoDoEmail(email)}`);
    const alerta: JobAlerta | null = regra
      ? { tenantId, conversaId: conversa.id, regra: regra.id }
      : null;
    if (regra) await subirUrgencia(tx, conversa.id, regra.prioridade);
    const [cv] = await tx
      .select({ estado: s.conversas.estado })
      .from(s.conversas)
      .where(eq(s.conversas.id, conversa.id));
    const agente: JobAgente | null =
      comIa && cv?.estado === "ia" ? { tenantId, conversaId: conversa.id } : null;
    return { chave: entrada.s3Chave, conversaId: conversa.id, ignorado: null, alerta, agente };
  });
  if (!r) return { conversaId: null, ignorado: null, alerta: null, agente: null };
  // Copiado para o S3 do cliente (ou descartado): o bruto sai do bucket da SES (LGPD).
  await bruto.apagar(r.chave).catch((err) => console.warn("[email] bruto não apagado:", err));
  return {
    conversaId: r.conversaId,
    ignorado: r.ignorado,
    alerta: r.alerta ?? null,
    agente: r.agente ?? null,
  };
}
