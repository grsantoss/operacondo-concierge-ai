/** Ingestão da base: Docling → páginas ruins no Claude → trechos por artigo. Banco local. */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";

// S3 substituído (o CI não tem SeaweedFS); mock.module vale para o processo todo.
const arquivos = new Map<string, Uint8Array>();
const real = await import("../src/server/arquivos");
mock.module("../src/server/arquivos", () => ({
  ...real,
  lerArquivo: async (c: string) => {
    const b = arquivos.get(c);
    if (!b) throw new Error("não existe");
    return b;
  },
}));

const { dbAdmin, schema: s } = await import("../src/server/db");
const { paginaRuim, porPagina } = await import("../src/server/ingest/docling");
const { cortarTrechos } = await import("../src/server/ingest/trechos");
const { ingerirDocumento } = await import("../src/server/ingest");

const CONVENCAO = `# CONVENÇÃO DO EDIFÍCIO SOL

Os condôminos instituem a presente convenção, que obriga todos os moradores do edifício.

## CAPÍTULO I

## DAS ÁREAS COMUNS

**Art. 1º** As áreas comuns são de uso de todos os condôminos e moradores, respeitado o regimento.

**Art. 2º** O salão de festas deve ser reservado com antecedência mínima de sete dias.

§ 1º É proibido som alto após as 22h, inclusive em festas no salão.

CAPÍTULO II – DO SÍNDICO

Artigo 3 - O síndico será eleito em assembleia geral ordinária para mandato de dois anos.`;

describe("cortarTrechos", () => {
  test("convenção: um trecho por artigo, parágrafos juntos, capítulo como contexto", () => {
    const t = cortarTrechos(CONVENCAO);
    expect(t.map((x) => x.referencia)).toEqual(["Preâmbulo", "Art. 1", "Art. 2", "Art. 3"]);
    expect(t[2]!.texto).toContain("§ 1º É proibido som alto");
    expect(t[2]!.texto).toStartWith("(CAPÍTULO I – DAS ÁREAS COMUNS)");
    expect(t[3]!.texto).toStartWith("(CAPÍTULO II – DO SÍNDICO)");
    expect(t[0]!.texto).not.toContain("CAPÍTULO");
  });

  test("cláusulas", () => {
    const t = cortarTrechos(
      "CLÁUSULA PRIMEIRA – Do objeto.\nTexto um.\n\nCláusula 2ª – Do prazo.\nTexto dois.",
    );
    expect(t.map((x) => x.referencia)).toEqual(["Cláusula Primeira", "Cláusula 2ª"]);
  });

  test("artigos colados no mesmo parágrafo (como o Docling devolve) são separados", () => {
    const t = cortarTrechos(
      "Art. 3º Cada unidade tem uma vaga, conforme o Art. 5º da convenção. Art. 4º É proibido lavar carros.\n\nArt. 5º Fim.",
    );
    expect(t.map((x) => x.referencia)).toEqual(["Art. 3", "Art. 4", "Art. 5"]);
    expect(t[0]!.texto).toContain("conforme o Art. 5º da convenção.");
  });

  test("ata sem artigos: por título; seção longa é dividida em partes", () => {
    const longo = Array.from(
      { length: 12 },
      (_, i) => `Parágrafo ${i} ${"palavra ".repeat(60)}`,
    ).join("\n\n");
    const t = cortarTrechos(`## Ata da AGO\n\nPresentes 40.\n\n## Item 1 – Obras\n\n${longo}`);
    expect(t[0]!.referencia).toBe("Ata da AGO");
    expect(t.length).toBeGreaterThan(2);
    expect(t[1]!.referencia).toBe("Item 1 – Obras (parte 1)");
    expect(t.every((x) => x.texto.length <= 3000)).toBe(true);
  });
});

describe("paginaRuim", () => {
  test.each([
    ["", true],
    ["<!-- image -->", true],
    [
      "Art. 1º O condomínio é regido por esta convenção e pelo regimento interno, aprovados em assembleia.",
      false,
    ],
    [
      "Art. 1º O cndmn rgd pr st cnvnç. Thrs lllll mmrrn bbcc dfgh jklm npqr stvw xyzz qwrt plmn bcdf ghjk",
      true,
    ],
    [
      "Ar# 1º ~~@@ ¬¬ ¤¤ «» ©® ¶¶ ¦¦ ±± ×× ÷÷ ¢¢ ££ ¥¥ ¿¿ ¡¡ ≈≈ ≠≠ ∞∞ ∆∆ ∑∑ ∏∏ √√ ∫∫ ⊂⊃ ⊆⊇ ∈∉ ∧∨ ⇒⇔ ↑↓",
      true,
    ],
  ])("%s → %s", (md, ruim) => {
    expect(paginaRuim(md)).toBe(ruim);
  });
});

describe("porPagina", () => {
  const Q = "<!-- oc:pagina -->";
  const item = (p: number, layer = "body") => ({ content_layer: layer, prov: [{ page_no: p }] });
  test("página sem itens (escaneada em branco) fica vazia, na posição certa", () => {
    const json = {
      pages: { 1: {}, 2: {}, 3: {} },
      texts: [item(1), item(1), item(3), item(2, "furniture")],
    };
    expect(porPagina(`um${Q}três`, json)).toEqual({ paginas: ["um", "", "três"], mapa: true });
  });
  test("mapa que não fecha: tudo na 1ª posição, mapa false", () => {
    const json = { pages: { 1: {}, 2: {} }, texts: [item(1)], pictures: [item(2)] };
    expect(porPagina(`a${Q}b${Q}c`, json)).toEqual({ paginas: ["a\n\nb\n\nc", ""], mapa: false });
  });
  test("DOCX (sem páginas)", () => {
    expect(porPagina("texto", { pages: {} })).toEqual({ paginas: ["texto"], mapa: true });
  });
});

describe("ingerirDocumento", () => {
  const admin = dbAdmin();
  let srv: ReturnType<typeof Bun.serve>;
  let tenantId: string, condo: string;
  const claude: { paginasNoPdf: number }[] = [];
  let doclingFora = false;
  const [antes, depois] = CONVENCAO.split("CAPÍTULO II");

  beforeAll(async () => {
    srv = Bun.serve({
      port: 0,
      async fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/v1/convert/file") {
          if (doclingFora) return new Response("fora", { status: 503 });
          const f = await req.formData();
          const q = String(f.get("md_page_break_placeholder"));
          const nome = (f.get("files") as File).name;
          // PDF de 3 páginas: a 2ª é escaneada e o OCR não leu nada.
          const md = nome.endsWith(".pdf")
            ? [antes, "<!-- image -->", `CAPÍTULO II${depois}`].join(`\n${q}\n`)
            : "# Comunicado\n\nA piscina fecha para manutenção na segunda-feira, das 8h às 17h.";
          const it = (p: number) => ({ content_layer: "body", prov: [{ page_no: p }] });
          const json = nome.endsWith(".pdf")
            ? { pages: { 1: {}, 2: {}, 3: {} }, texts: [it(1), it(3)], pictures: [it(2)] }
            : { pages: {} };
          return Response.json({
            status: "success",
            errors: [],
            document: { md_content: md, json_content: json },
          });
        }
        if (u.pathname === "/v1/messages") {
          const body = (await req.json()) as {
            messages: { content: { type: string; source: { data: string } }[] }[];
          };
          const doc = body.messages[0]!.content.find((c) => c.type === "document")!;
          const pdf = await PDFDocument.load(Buffer.from(doc.source.data, "base64"));
          claude.push({ paginasNoPdf: pdf.getPageCount() });
          return Response.json({
            id: "msg_teste",
            type: "message",
            role: "assistant",
            model: "claude-haiku-5-5",
            content: [
              {
                type: "text",
                text: "**Art. 4º** As vagas de garagem são numeradas e vinculadas às unidades do edifício.",
              },
            ],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 1500, output_tokens: 40 },
          });
        }
        return new Response("?", { status: 404 });
      },
    });
    process.env.DOCLING_URL = `http://localhost:${srv.port}`;
    process.env.ANTHROPIC_BASE_URL = `http://localhost:${srv.port}`;
    process.env.ANTHROPIC_API_KEY = "chave-teste";
    const [t] = await admin
      .insert(s.tenants)
      .values({ razaoSocial: "Teste Ingestão", nomeFantasia: "Teste Ingestão" })
      .returning();
    tenantId = t!.id;
    const [c] = await admin
      .insert(s.condominios)
      .values({ tenantId, nome: "Edifício Sol", tipo: "vertical" })
      .returning();
    condo = c!.id;
  });

  afterAll(async () => {
    srv.stop();
    for (const k of ["DOCLING_URL", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY"])
      delete process.env[k];
    await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
  });

  async function documento(nome: string, bytes: Uint8Array) {
    const caminho = `${tenantId}/${condo}/convencao/${crypto.randomUUID()}-${nome}`;
    arquivos.set(caminho, bytes);
    const [d] = await admin
      .insert(s.documentos)
      .values({
        tenantId,
        condominioId: condo,
        titulo: nome,
        colecao: "convencao",
        storagePath: caminho,
      })
      .returning();
    return d!.id;
  }
  const ler = (id: string) =>
    admin
      .select()
      .from(s.documentos)
      .where(eq(s.documentos.id, id))
      .then((r) => r[0]!);
  const trechos = (id: string) =>
    admin
      .select()
      .from(s.documentoTrechos)
      .where(eq(s.documentoTrechos.documentoId, id))
      .orderBy(asc(s.documentoTrechos.ordem));
  async function pdf3() {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 3; i++) pdf.addPage();
    return pdf.save();
  }

  test("PDF: só a página ruim vai ao Claude; trechos por artigo; uso gravado", async () => {
    const id = await documento("convencao.pdf", await pdf3());
    await ingerirDocumento({ tenantId, documentoId: id });

    expect(claude.at(-1)).toEqual({ paginasNoPdf: 1 });
    const d = await ler(id);
    expect(d).toMatchObject({ status: "treinado", origemTexto: "claude", leituraAviso: null });
    const t = await trechos(id);
    expect(t.map((x) => x.referencia)).toEqual([
      "Preâmbulo",
      "Art. 1",
      "Art. 2",
      "Art. 4",
      "Art. 3",
    ]);
    expect(t.every((x) => x.condominioId === condo)).toBe(true);
    const [uso] = await admin
      .select()
      .from(s.llmExecucoes)
      .where(eq(s.llmExecucoes.tenantId, tenantId));
    expect(uso).toMatchObject({
      modelo: "claude-haiku-5-5",
      tokensEntrada: 1500,
      tokensSaida: 40,
      conversaId: null,
    });
  });

  test("sem chave do Claude: fica para revisão, com as páginas no aviso", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const id = await documento("regimento.pdf", await pdf3());
    await ingerirDocumento({ tenantId, documentoId: id });
    process.env.ANTHROPIC_API_KEY = "chave-teste";
    const d = await ler(id);
    expect(d.status).toBe("revisao");
    expect(d.leituraAviso).toContain("a página 2");
    expect((await trechos(id)).length).toBe(4);
  });

  test("TXT direto, sem Docling; ler de novo substitui os trechos", async () => {
    const id = await documento("aviso.txt", new TextEncoder().encode(CONVENCAO));
    await ingerirDocumento({ tenantId, documentoId: id });
    await ingerirDocumento({ tenantId, documentoId: id });
    const d = await ler(id);
    expect(d.status).toBe("treinado");
    expect(d.origemTexto).toBeNull();
    expect((await trechos(id)).length).toBe(4);
  });

  test("Docling fora do ar: status erro com o motivo e o job falha (a fila tenta de novo)", async () => {
    doclingFora = true;
    const id = await documento("comunicado.docx", new Uint8Array([1, 2, 3]));
    await expect(ingerirDocumento({ tenantId, documentoId: id })).rejects.toThrow(/503/);
    doclingFora = false;
    const d = await ler(id);
    expect(d.status).toBe("erro");
    expect(d.leituraAviso).toContain("O serviço de leitura está fora do ar");
  });
});
