/**
 * Job da fila "ingestao": lê o documento da base (S3) e grava os trechos citáveis.
 * TXT/MD direto; PDF, DOCX e imagem pelo Docling; páginas com OCR ruim pelo Claude.
 * Status: processando → treinado (pronto para a IA) | revisao (páginas ilegíveis) | erro.
 */
import { eq } from "drizzle-orm";
import { lerArquivo } from "@/server/arquivos";
import { schema as s, withTenant } from "@/server/db";
import { converterDocling, ErroDocling, paginaRuim } from "@/server/ingest/docling";
import {
  ErroLeitura,
  fallbackConfigurado,
  lerComClaude,
  type Leitura,
} from "@/server/ingest/fallback";
import { cortarTrechos } from "@/server/ingest/trechos";
import type { JobIngestao } from "@/server/queue";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
/** Páginas por chamada ao Claude (cabe em 16 mil tokens de saída, sem streaming). */
const LOTE_CLAUDE = 10;
/** Resposta do Claude para página realmente vazia (não é erro de leitura). */
const BRANCA = "[página em branco]";

function listaPaginas(ns: number[]): string {
  const p = ns.map((n) => n + 1);
  return p.length === 1
    ? `a página ${p[0]}`
    : `as páginas ${p.slice(0, -1).join(", ")} e ${p.at(-1)}`;
}

export async function ingerirDocumento(job: JobIngestao): Promise<void> {
  const doc = await withTenant(job.tenantId, async (tx) => {
    const [d] = await tx
      .update(s.documentos)
      .set({ status: "processando", leituraAviso: null })
      .where(eq(s.documentos.id, job.documentoId))
      .returning();
    return d;
  });
  if (!doc) return; // excluído antes da leitura

  try {
    const ext = doc.storagePath.split(".").pop()!.toLowerCase();
    const bytes = await lerArquivo(doc.storagePath);
    const usos: Leitura["uso"][] = [];
    let paginas: string[];
    let aviso: string | null = null;
    let usouClaude = false;

    if (ext === "txt" || ext === "md") {
      paginas = [new TextDecoder().decode(bytes)];
    } else {
      const mime = MIME[ext];
      if (!mime) throw new ErroLeitura(`Formato .${ext} não suportado.`);
      const lido = await converterDocling(bytes, `documento.${ext}`, mime);
      paginas = lido.paginas;
      const todas = paginas.map((_, i) => i);
      // DOCX tem texto de verdade (sem OCR): não passa pela checagem de página. Sem mapa de
      // páginas, é tudo ou nada (o texto todo está na 1ª posição).
      const ruins =
        ext === "docx"
          ? []
          : lido.mapa
            ? todas.filter((i) => paginaRuim(paginas[i]!))
            : paginaRuim(paginas.join("\n"))
              ? todas
              : [];
      if (ruins.length && fallbackConfigurado()) {
        for (let i = 0; i < ruins.length; i += LOTE_CLAUDE) {
          const lote = ruins.slice(i, i + LOTE_CLAUDE);
          const r = await lerComClaude(bytes, mime, mime === "application/pdf" ? lote : [0]);
          lote.forEach((n, k) => (paginas[n] = r.paginas[k] ?? ""));
          usos.push(r.uso);
        }
        usouClaude = true;
        // Depois do Claude, página curta é legítima; só conta o que ele não conseguiu ler.
        const aindaRuins = ruins.filter(
          (n) => !paginas[n]!.trim() || paginas[n]!.includes("[ilegível]"),
        );
        if (aindaRuins.length)
          aviso = `Não consegui ler bem ${listaPaginas(aindaRuins)}. Confira o arquivo ou envie uma versão mais nítida.`;
      } else if (ruins.length) {
        aviso = `Não consegui ler bem ${listaPaginas(ruins)} (leitura por IA desligada). Envie uma versão mais nítida ou em texto.`;
      }
    }

    const trechos = cortarTrechos(paginas.map((p) => (p.trim() === BRANCA ? "" : p)).join("\n\n"));
    if (!trechos.length) throw new ErroLeitura("Nenhum texto encontrado no arquivo.");

    await withTenant(job.tenantId, async (tx) => {
      await tx.delete(s.documentoTrechos).where(eq(s.documentoTrechos.documentoId, doc.id));
      await tx.insert(s.documentoTrechos).values(
        trechos.map((t, ordem) => ({
          tenantId: job.tenantId,
          documentoId: doc.id,
          condominioId: doc.condominioId,
          referencia: t.referencia,
          ordem,
          texto: t.texto,
        })),
      );
      if (usos.length)
        // ponytail: sem coluna de "tipo"; conversa_id nulo = leitura de documento.
        await tx
          .insert(s.llmExecucoes)
          .values(
            usos.map((u) => ({ tenantId: job.tenantId, condominioId: doc.condominioId, ...u })),
          );
      await tx
        .update(s.documentos)
        .set({
          status: aviso ? "revisao" : "treinado",
          origemTexto: ext === "txt" || ext === "md" ? null : usouClaude ? "claude" : "docling",
          leituraAviso: aviso,
        })
        .where(eq(s.documentos.id, doc.id));
    });
  } catch (e) {
    // Detalhe técnico no log; na tela, só texto para o síndico. A fila ainda tenta de novo.
    console.error(`[ingestao] documento ${doc.id}:`, e);
    const paraTela =
      e instanceof ErroDocling
        ? e.paraTela
        : e instanceof ErroLeitura
          ? e.message
          : "Erro inesperado na leitura. Vamos tentar de novo sozinhos; se continuar, use “Ler de novo”.";
    await withTenant(job.tenantId, (tx) =>
      tx
        .update(s.documentos)
        .set({ status: "erro", leituraAviso: paraTela })
        .where(eq(s.documentos.id, doc.id)),
    );
    throw e;
  }
}
