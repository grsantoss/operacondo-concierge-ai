/** Mídia do WhatsApp: rotear → fila "midia" → S3 + transcrição → regras de urgência. Banco local. */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

// S3 substituído: o CI não tem SeaweedFS. Registra o que seria gravado.
const gravados: { caminho: string; tamanho: number; tipo: string }[] = [];
// mock.module vale para o processo todo: mantém o resto do módulo real.
const real = await import("../src/server/arquivos");
mock.module("../src/server/arquivos", () => ({
  ...real,
  gravarArquivo: async (caminho: string, corpo: Uint8Array, tipo: string) => {
    gravados.push({ caminho, tamanho: corpo.byteLength, tipo });
  },
  linkTemporario: async (c: string) => `https://s3.teste/${c}`,
}));

const { cifrar } = await import("../src/server/cripto");
const { dbAdmin, schema: s } = await import("../src/server/db");
const { extensao, processarMidia } = await import("../src/server/pipeline/midia");
const { processarConversa } = await import("../src/server/pipeline/processar");
const { rotear } = await import("../src/server/pipeline/roteamento");
const { transcrever } = await import("../src/server/whatsapp/transcricao");

process.env.CREDENCIAIS_CHAVE ??= Buffer.alloc(32, 7).toString("base64");
const admin = dbAdmin();
const AUDIO = new Uint8Array([79, 103, 103, 83, 1, 2, 3]); // "OggS…"
let srv: ReturnType<typeof Bun.serve>;
let base = "";
let tenantId: string, canalId: string, condo: string;
const recebidosTranscricao: { caminho: string; auth: string | null }[] = [];

beforeAll(async () => {
  srv = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/m/audio")
        return new Response(AUDIO, { headers: { "content-type": "audio/ogg" } });
      if (u.pathname === "/m/foto")
        return new Response(new Uint8Array(10), { headers: { "content-type": "image/jpeg" } });
      if (u.pathname === "/m/sumiu") return new Response("expirou", { status: 404 });
      recebidosTranscricao.push({
        caminho: u.pathname + u.search,
        auth: req.headers.get("authorization"),
      });
      if (u.pathname === "/v1/audio/transcriptions")
        return Response.json({ text: "Socorro, cheiro de gás no apartamento" });
      if (u.pathname === "/v1/listen")
        return Response.json({
          results: { channels: [{ alternatives: [{ transcript: "bom dia síndico" }] }] },
        });
      // envio de mensagens (send-text)
      return Response.json({ messageId: `OUT-${Date.now()}-${Math.random()}` });
    },
  });
  base = `http://localhost:${srv.port}`;
  process.env.ZAPI_URL = base;
  process.env.TRANSCRICAO_URL = `${base}/v1`;
  process.env.TRANSCRICAO_PROVEDOR = "openai";
  process.env.TRANSCRICAO_API_KEY = "chave-teste";
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Teste Mídia", nomeFantasia: "Teste Mídia" })
    .returning();
  tenantId = t!.id;
  const [c] = await admin
    .insert(s.condominios)
    .values({ tenantId, nome: "Edifício Mar", tipo: "vertical" })
    .returning();
  condo = c!.id;
  const [ca] = await admin
    .insert(s.whatsappCanais)
    .values({
      tenantId,
      phoneE164: "+5511900003333",
      provider: "zapi",
      instanceId: "INST-MIDIA",
      credenciaisCifradas: cifrar(JSON.stringify({ token: "tok" })),
    })
    .returning();
  canalId = ca!.id;
});

afterAll(async () => {
  srv.stop();
  for (const k of ["ZAPI_URL", "TRANSCRICAO_URL", "TRANSCRICAO_PROVEDOR", "TRANSCRICAO_API_KEY"])
    delete process.env[k];
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
});

let n = 0;
async function receber(payload: Record<string, unknown>) {
  const telefone = "+5511912340000";
  await admin.insert(s.whatsappEntradas).values({
    tenantId,
    canalId,
    telefone,
    providerMsgId: `MID-${++n}`,
    payload: { type: "ReceivedCallback", ...payload },
  });
  const job = { tenantId, canalId, telefone };
  let midias: Awaited<ReturnType<typeof rotear>>["midias"] = [];
  await processarConversa(job, async (e) => {
    midias = (await rotear(job, e)).midias;
  });
  return midias;
}

test("extensão pelo mime ou pela URL", () => {
  expect(extensao("audio/ogg; codecs=opus", "https://x/a")).toBe("ogg");
  expect(extensao("application/octet-stream", "https://x/doc/contrato.PDF")).toBe("pdf");
  expect(extensao("application/x-desconhecido", "https://x/sem-ext")).toBe("bin");
});

describe("mídia", () => {
  test("áudio: guarda no S3, transcreve e a transcrição dispara a regra de urgência", async () => {
    const midias = await receber({
      audio: { audioUrl: `${base}/m/audio`, mimeType: "audio/ogg; codecs=opus" },
    });
    expect(midias).toHaveLength(1);
    const { alerta } = await processarMidia(midias[0]!);

    const g = gravados.at(-1)!;
    expect(g.caminho).toMatch(
      new RegExp(`^${tenantId}/${condo}/whatsapp/[0-9a-f-]+/[0-9a-f-]+[.]ogg$`),
    );
    expect(g).toMatchObject({ tamanho: AUDIO.byteLength, tipo: "audio/ogg" });
    expect(recebidosTranscricao.at(-1)!.auth).toBe("Bearer chave-teste");

    const [m] = await admin
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.id, midias[0]!.mensagemId));
    expect(m).toMatchObject({
      midiaPath: g.caminho,
      transcricao: "Socorro, cheiro de gás no apartamento",
    });
    expect(alerta?.regra).toBe("gas");
    const [cv] = await admin.select().from(s.conversas).where(eq(s.conversas.id, m!.conversaId));
    expect(cv!.prioridade).toBe("critica");
  });

  test("imagem: guarda com a legenda, sem transcrição", async () => {
    const midias = await receber({
      image: { imageUrl: `${base}/m/foto`, mimeType: "image/jpeg", caption: "olha a infiltração" },
    });
    const antes = recebidosTranscricao.length;
    await processarMidia(midias[0]!);
    expect(gravados.at(-1)!.caminho).toEndWith(".jpg");
    expect(recebidosTranscricao.length).toBe(antes);
    const [m] = await admin
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.id, midias[0]!.mensagemId));
    expect(m).toMatchObject({ tipo: "imagem", texto: "olha a infiltração", transcricao: null });
  });

  test("URL expirada: erro para a fila tentar de novo, nada gravado", async () => {
    const midias = await receber({ audio: { audioUrl: `${base}/m/sumiu` } });
    const antes = gravados.length;
    await expect(processarMidia(midias[0]!)).rejects.toThrow(/404/);
    expect(gravados.length).toBe(antes);
  });

  test("Deepgram e sem provedor", async () => {
    process.env.TRANSCRICAO_PROVEDOR = "deepgram";
    expect(await transcrever(AUDIO, "audio/ogg")).toBe("bom dia síndico");
    expect(recebidosTranscricao.at(-1)).toEqual({
      caminho: "/v1/listen?model=nova-2&language=pt-BR&smart_format=true",
      auth: "Token chave-teste",
    });
    delete process.env.TRANSCRICAO_PROVEDOR;
    expect(await transcrever(AUDIO, "audio/ogg")).toBeNull();
    process.env.TRANSCRICAO_PROVEDOR = "openai";
  });
});
