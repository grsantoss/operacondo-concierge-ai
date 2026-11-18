/**
 * Base de conhecimento: arquivos no S3 e registro em `documentos`. O envio enfileira a leitura
 * (fila "ingestao": Docling, fallback no Claude, corte por artigo em `documento_trechos`).
 */
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Documento } from "@/data/base";
import { apagarArquivo, gravarArquivo, linkTemporario, nomeSeguro } from "@/server/arquivos";
import { exigirCliente } from "@/server/auth/contexto";
import { exigirLimite } from "@/server/billing/limites";
import { schema as s, withTenant } from "@/server/db";
import { enfileirarIngestao } from "@/server/queue";

const TZ = "America/Sao_Paulo";

function tamanho(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const listarDocumentos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Documento[]> => {
    const { tenantId } = await exigirCliente();
    const linhas = await withTenant(tenantId, (tx) =>
      tx
        .select({
          d: s.documentos,
          condominio: s.condominios.nome,
          trechos: sql<number>`(select count(*)::int from documento_trechos t where t.documento_id = ${s.documentos.id})`,
        })
        .from(s.documentos)
        .innerJoin(s.condominios, eq(s.condominios.id, s.documentos.condominioId))
        .orderBy(desc(s.documentos.criadoEm)),
    );
    // ponytail: devolve todos; paginar quando as atas passarem de algumas centenas por cliente.
    return Promise.all(
      linhas.map(async ({ d, condominio, trechos }) => ({
        id: d.id,
        titulo: d.titulo,
        colecao: d.colecao,
        visibilidade: d.visibilidade,
        condominioId: d.condominioId,
        condominio,
        tamanho: tamanho(d.tamanhoBytes),
        enviadoEm: d.criadoEm.toLocaleDateString("pt-BR", { timeZone: TZ }),
        vigenteDesde: d.vigenteDesde?.split("-").reverse().join("/"),
        status: d.status,
        aviso: d.leituraAviso,
        trechos,
        url: await linkTemporario(d.storagePath, d.titulo),
      })),
    );
  },
);

const LIMITE = 20 * 1024 * 1024;
/** O que o Docling lê. `.doc` antigo fica de fora (o Docling não abre). */
const EXTENSOES = [".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];

/** FormData: condominioId, titulo, colecao, visibilidade, vigenteDesde? e arquivos (1 a 10). */
export const enviarDocumentos = createServerFn({ method: "POST" })
  .inputValidator((fd: unknown) => {
    if (!(fd instanceof FormData)) throw new Error("Envio inválido.");
    const meta = z
      .object({
        condominioId: z.string().uuid("Escolha o condomínio."),
        titulo: z.string().trim().min(3).max(120),
        colecao: z.enum(s.colecao.enumValues),
        visibilidade: z.enum(s.visibilidade.enumValues),
        vigenteDesde: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
      })
      .parse({
        condominioId: fd.get("condominioId"),
        titulo: fd.get("titulo"),
        colecao: fd.get("colecao"),
        visibilidade: fd.get("visibilidade"),
        vigenteDesde: fd.get("vigenteDesde") || null,
      });
    const arquivos = fd
      .getAll("arquivos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (!arquivos.length) throw new Error("Selecione ao menos um arquivo.");
    if (arquivos.length > 10) throw new Error("Envie no máximo 10 arquivos por vez.");
    for (const f of arquivos) {
      if (f.size > LIMITE) throw new Error(`${f.name}: maior que 20 MB.`);
      if (/\.doc$/i.test(f.name))
        throw new Error(
          `${f.name}: arquivo .doc (Word antigo) não é lido. Abra no Word e salve como .docx ou PDF.`,
        );
      if (!EXTENSOES.some((e) => f.name.toLowerCase().endsWith(e)))
        throw new Error(`${f.name}: formato não suportado (use PDF, DOCX, TXT, MD, PNG ou JPG).`);
    }
    return { ...meta, arquivos };
  })
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    const { arquivos, ...meta } = data;
    const ids = await withTenant(tenantId, async (tx) => {
      const ids: string[] = [];
      // A FK composta já impede condomínio de outro cliente; a checagem dá a mensagem certa.
      const [c] = await tx
        .select({ id: s.condominios.id })
        .from(s.condominios)
        .where(eq(s.condominios.id, meta.condominioId));
      if (!c) throw new Error("Condomínio não encontrado.");
      await exigirLimite(tx, "documentos", arquivos.length);
      for (const f of arquivos) {
        const caminho = `${tenantId}/${c.id}/${meta.colecao}/${crypto.randomUUID()}-${nomeSeguro(f.name)}`;
        await gravarArquivo(
          caminho,
          new Uint8Array(await f.arrayBuffer()),
          f.type || "application/octet-stream",
        );
        const [d] = await tx
          .insert(s.documentos)
          .values({
            tenantId,
            condominioId: c.id,
            // Um arquivo: o título digitado. Vários: o nome de cada arquivo.
            titulo: arquivos.length === 1 ? meta.titulo : f.name.replace(/\.[^.]+$/, ""),
            colecao: meta.colecao,
            visibilidade: meta.visibilidade,
            vigenteDesde: meta.vigenteDesde ?? null,
            storagePath: caminho,
            tamanhoBytes: f.size,
          })
          .returning({ id: s.documentos.id });
        ids.push(d!.id);
      }
      return ids;
    });
    // Depois do commit: se a fila falhar, o documento fica "enviado" e pode ser lido de novo.
    await enfileirarIngestao(ids.map((documentoId) => ({ tenantId, documentoId })));
  });

/** Lê de novo (após erro, revisão ou troca do provedor de leitura). */
export const lerDocumentoDeNovo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    const r = await withTenant(tenantId, (tx) =>
      tx
        .update(s.documentos)
        .set({ status: "enviado", leituraAviso: null })
        .where(eq(s.documentos.id, data.id))
        .returning({ id: s.documentos.id }),
    );
    if (!r.length) throw new Error("Documento não encontrado.");
    await enfileirarIngestao([{ tenantId, documentoId: data.id }]);
  });

/** Remove da base e do S3 (os trechos saem junto, por cascade). */
export const excluirDocumento = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { tenantId } = await exigirCliente();
    const [d] = await withTenant(tenantId, (tx) =>
      tx
        .delete(s.documentos)
        .where(eq(s.documentos.id, data.id))
        .returning({ caminho: s.documentos.storagePath }),
    ).catch((e: { code?: string; cause?: { code?: string } }) => {
      if ((e.cause?.code ?? e.code) === "23503")
        throw new Error("Uma ata da base revoga este documento. Remova a ata antes.");
      throw e;
    });
    if (!d) throw new Error("Documento não encontrado.");
    // Depois do banco: se o S3 falhar, sobra só um arquivo órfão, nunca uma linha sem arquivo.
    await apagarArquivo(d.caminho).catch(() => undefined);
  });
