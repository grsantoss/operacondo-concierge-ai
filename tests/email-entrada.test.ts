/** Entrada de e-mail (#79): SNS assinado → email_entradas → fila → conversa. Banco local. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSign, generateKeyPairSync } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { dbAdmin, schema as s } from "../src/server/db";
import { garantirCanalEmail, slug } from "../src/server/email-entrada/canal";
import { htmlParaTexto, limparTexto, motivoIgnorar } from "../src/server/email-entrada/limpar";
import { processarEmail, type Bruto } from "../src/server/email-entrada/processar";
import { textoAssinado, type MensagemSns } from "../src/server/email-entrada/sns";
import { receberWebhookSes } from "../src/server/email-entrada/webhook";
import { pararFila } from "../src/server/queue";

const admin = dbAdmin();
const TOPICO = "arn:aws:sns:sa-east-1:123456789012:concierge-entrada";
const CERT = "https://sns.sa-east-1.amazonaws.com/SimpleNotificationService-teste.pem";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const buscar = async () => publicKey.export({ type: "spki", format: "pem" }).toString();
let tenantId: string;
let endereco: string;

function sns(m: Partial<MensagemSns>): MensagemSns {
  const base = {
    Type: "Notification",
    MessageId: crypto.randomUUID(),
    TopicArn: TOPICO,
    Message: "{}",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "2",
    SigningCertURL: CERT,
    Signature: "",
    ...m,
  } as MensagemSns;
  base.Signature = createSign("RSA-SHA256").update(textoAssinado(base)).sign(privateKey, "base64");
  return base;
}
const aviso = (chave: string, messageId: string, dkim = "PASS") =>
  JSON.stringify({
    notificationType: "Received",
    mail: { messageId: "ses-1", commonHeaders: { messageId } },
    receipt: {
      recipients: [endereco.toUpperCase()],
      action: { type: "S3", bucketName: "ses-entrada", objectKey: chave },
      spfVerdict: { status: "PASS" },
      dkimVerdict: { status: dkim },
      dmarcVerdict: { status: dkim },
      spamVerdict: { status: "PASS" },
      virusVerdict: { status: "PASS" },
    },
  });
const post = (corpo: unknown) =>
  receberWebhookSes(
    new Request("http://x/api/email/ses", { method: "POST", body: JSON.stringify(corpo) }),
    buscar,
  );
const entradas = () =>
  admin.select().from(s.emailEntradas).where(eq(s.emailEntradas.tenantId, tenantId));

const PDF = Buffer.from("%PDF-1.4 orçamento").toString("base64");
const EMAIL = `From: Ana Souza <Ana@Exemplo.com>
To: atendimento@exemplo
Subject: Vazamento na garagem
Message-ID: <msg-1@exemplo.com>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="B"

--B
Content-Type: text/plain; charset=utf-8

Bom dia, tem um vazamento na vaga 12.
Ana

Enviado do meu iPhone

Em qua., 18 de nov. de 2026 às 10:00, Síndico <sindico@x.com>
escreveu:
> mensagem antiga
--B
Content-Type: application/pdf; name="orçamento.pdf"
Content-Disposition: attachment; filename="orçamento.pdf"
Content-Transfer-Encoding: base64

${PDF}
--B
Content-Type: image/png
Content-Disposition: inline
Content-ID: <logo>
Content-Transfer-Encoding: base64

iVBORw0KGgo=
--B--
`;
const AUTO = `From: Ana <ana@exemplo.com>
Subject: Resposta automática: Re: aviso
Auto-Submitted: auto-replied
Message-ID: <auto-1@exemplo.com>

Estou fora até segunda.
`;

const brutos = new Map<string, string>([
  ["ses-entrada/email-1", EMAIL],
  ["ses-entrada/auto-1", AUTO],
]);
const apagados: string[] = [];
const gravados: string[] = [];
const bruto: Bruto = {
  ler: async (k) => new TextEncoder().encode(brutos.get(k)!),
  apagar: async (k) => {
    apagados.push(k);
  },
};
const gravar = async (caminho: string) => {
  gravados.push(caminho);
};

beforeAll(async () => {
  process.env.SES_ENTRADA_TOPICO = TOPICO;
  process.env.EMAIL_DOMINIO = "atendimento.operacondo.local";
  const [t] = await admin
    .insert(s.tenants)
    .values({ razaoSocial: "Condomínio Ação Ltda", nomeFantasia: "Edifício Ação & Cia" })
    .returning();
  tenantId = t!.id;
  endereco = await garantirCanalEmail(tenantId);
});

afterAll(async () => {
  await admin.execute(
    sql`delete from pgboss.job where name = 'email' and data->>'entradaId' in (select id::text from email_entradas where tenant_id = ${tenantId})`,
  );
  await admin.delete(s.tenants).where(eq(s.tenants.id, tenantId));
  await pararFila(false);
});

describe("endereço de atendimento", () => {
  test("nome sem acento, minúsculo e o mesmo nas próximas vezes", async () => {
    expect(slug("Edifício Ação & Cia")).toBe("edificio-acao-cia");
    expect(endereco).toBe("edificio-acao-cia@atendimento.operacondo.local");
    expect(await garantirCanalEmail(tenantId)).toBe(endereco);
  });
});

describe("limpeza do texto", () => {
  test("tira histórico citado, assinatura e 'Enviado do meu'", () => {
    expect(
      limparTexto("Oi, a piscina abre?\n\n-- \nAna\n\nOn Tue, Nov 17 Bob wrote:\n> antes"),
    ).toBe("Oi, a piscina abre?");
    expect(
      limparTexto("Pode trocar a lâmpada?\n\nDe: Síndico\nEnviado: terça\nAssunto: x\ncorpo"),
    ).toBe("Pode trocar a lâmpada?");
  });

  test("HTML vira texto, sem citação nem estilo", () => {
    expect(
      htmlParaTexto(
        "<style>p{}</style><p>Olá&nbsp;síndico,</p><p>tudo bem?<br>Ana</p><blockquote>antigo</blockquote>",
      ).trim(),
    ).toBe("Olá síndico,\ntudo bem?\nAna");
  });

  test("respostas automáticas, listas e loops são ignorados", () => {
    const h = (key: string, value: string) => ({ key, originalKey: key, value });
    const ignora = (headers: ReturnType<typeof h>[], de = "ana@x.com", subject = "Oi") =>
      motivoIgnorar({ headers, subject }, de, ["atendimento.operacondo.local"]);
    expect(ignora([h("auto-submitted", "auto-replied")])).toBe("resposta automática");
    expect(ignora([h("auto-submitted", "no")])).toBeNull();
    expect(ignora([h("list-id", "<x.y>")])).toBe("lista de e-mails");
    expect(ignora([h("precedence", "bulk")])).toBe("lista ou envio em massa");
    expect(ignora([], "MAILER-DAEMON@x.com")).toBe("remetente automático");
    expect(ignora([], "aurora@atendimento.operacondo.local")).toBe(
      "enviado pelo próprio Concierge",
    );
    expect(ignora([], "ana@x.com", "Out of Office: férias")).toBe("fora do escritório");
    expect(ignora([])).toBeNull();
  });
});

describe("webhook do SNS", () => {
  test("recusa assinatura errada, tópico de outro e certificado fora da AWS", async () => {
    const m = sns({ Message: aviso("email-1", "<msg-1@exemplo.com>") });
    expect((await post({ ...m, Message: m.Message + " " })).status).toBe(403);
    expect((await post(sns({ TopicArn: "arn:aws:sns:sa-east-1:1:outro" }))).status).toBe(403);
    expect((await post(sns({ SigningCertURL: "https://evil.example.com/x.pem" }))).status).toBe(
      403,
    );
    expect(await entradas()).toHaveLength(0);
  });

  test("grava a entrada com os veredictos e não duplica a reentrega", async () => {
    const m = sns({ Message: aviso("email-1", "<msg-1@exemplo.com>") });
    expect((await post(m)).status).toBe(200);
    expect((await post(sns({ Message: aviso("email-1", "<msg-1@exemplo.com>") }))).status).toBe(
      200,
    );
    const e = await entradas();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      messageId: "<msg-1@exemplo.com>",
      s3Chave: "ses-entrada/email-1",
      autenticacao: { spf: "PASS", dkim: "PASS", dmarc: "PASS", spam: "PASS", virus: "PASS" },
    });
  });

  test("destinatário desconhecido não vira entrada", async () => {
    const outro = JSON.parse(aviso("x", "<x@y>"));
    outro.receipt.recipients = ["ninguem@atendimento.operacondo.local"];
    const r = await post(sns({ Message: JSON.stringify(outro) }));
    expect(await r.json()).toMatchObject({ ignorado: "destinatário desconhecido" });
  });
});

describe("processamento", () => {
  test("e-mail vira conversa de e-mail para o síndico, com texto limpo e o anexo", async () => {
    const [e] = await entradas();
    const r = await processarEmail(e!.id, bruto, gravar);
    expect(r.ignorado).toBeNull();
    const [cv] = await admin.select().from(s.conversas).where(eq(s.conversas.id, r.conversaId!));
    expect(cv).toMatchObject({
      canal: "email",
      endereco: "ana@exemplo.com",
      estado: "aguardando_sindico",
    });
    const msgs = await admin
      .select()
      .from(s.mensagens)
      .where(eq(s.mensagens.conversaId, cv!.id))
      .orderBy(s.mensagens.criadoEm);
    expect(msgs.map((m) => m.tipo)).toEqual(["texto", "documento"]);
    expect(msgs[0]).toMatchObject({
      texto: "Bom dia, tem um vazamento na vaga 12.\nAna",
      assunto: "Vazamento na garagem",
      messageId: "<msg-1@exemplo.com>",
      autor: "morador",
    });
    // Anexo e original no S3 do cliente; a imagem embutida (logo) fica de fora.
    expect(msgs[1]!.midiaPath).toBe(
      `${tenantId}/sem-condominio/email/${cv!.id}/${msgs[1]!.id}.pdf`,
    );
    expect(gravados).toEqual([
      msgs[1]!.midiaPath,
      `${tenantId}/sem-condominio/email/${cv!.id}/${msgs[0]!.id}.eml`,
    ]);
    expect(apagados).toEqual(["ses-entrada/email-1"]);
    const [depois] = await entradas();
    expect(depois).toMatchObject({ mensagemId: msgs[0]!.id, ignorado: null });
    expect(depois!.processadoEm).not.toBeNull();
    // Processar de novo não duplica.
    expect((await processarEmail(e!.id, bruto, gravar)).conversaId).toBeNull();
    const [canal] = await admin
      .select()
      .from(s.emailCanais)
      .where(eq(s.emailCanais.tenantId, tenantId));
    expect(canal!.status).toBe("conectado");
  });

  test("resposta automática não abre conversa e o bruto é apagado", async () => {
    await post(sns({ Message: aviso("auto-1", "<auto-1@exemplo.com>") }));
    const e = (await entradas()).find((x) => x.messageId === "<auto-1@exemplo.com>")!;
    const antes = await admin.$count(s.conversas, eq(s.conversas.tenantId, tenantId));
    expect((await processarEmail(e.id, bruto, gravar)).ignorado).toBe("resposta automática");
    expect(await admin.$count(s.conversas, eq(s.conversas.tenantId, tenantId))).toBe(antes);
    expect(apagados).toContain("ses-entrada/auto-1");
  });
});

describe("roteamento pelo remetente", () => {
  let condo: string;
  let carla: string;
  const simples = (de: string, assunto: string, id: string) =>
    `From: ${de}\nSubject: ${assunto}\nMessage-ID: <${id}@exemplo.com>\n\nOlá, preciso de ajuda.\n`;
  async function receber(chave: string, de: string, assunto: string, dkim: string) {
    brutos.set(`ses-entrada/${chave}`, simples(de, assunto, chave));
    await post(sns({ Message: aviso(chave, `<${chave}@exemplo.com>`, dkim) }));
    const e = (await entradas()).find((x) => x.messageId === `<${chave}@exemplo.com>`)!;
    return processarEmail(e.id, bruto, gravar);
  }
  const conversa = async (id: string) =>
    (await admin.select().from(s.conversas).where(eq(s.conversas.id, id)))[0]!;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "teste";
    const [c] = await admin
      .insert(s.condominios)
      .values({ tenantId, nome: "Edifício Ipê", tipo: "vertical" })
      .returning();
    condo = c!.id;
    const [m] = await admin
      .insert(s.moradores)
      .values({
        tenantId,
        condominioId: condo,
        nome: "Carla",
        cadastro: "aprovado",
        email: "Carla@Exemplo.com",
      })
      .returning();
    carla = m!.id;
  });
  afterAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("DKIM aprovado: reconhece o morador e o condomínio e pede o rascunho ao agente", async () => {
    const r = await receber("carla-1", "Carla <carla@exemplo.com>", "Reserva do salão", "PASS");
    expect(r.agente).toEqual({ tenantId, conversaId: r.conversaId! });
    expect(await conversa(r.conversaId!)).toMatchObject({
      condominioId: condo,
      moradorId: carla,
      estado: "ia",
    });
    await admin
      .update(s.conversas)
      .set({ estado: "resolvida" })
      .where(eq(s.conversas.id, r.conversaId!));
  });

  test("sem DKIM nem DMARC: o mesmo e-mail vira remetente desconhecido (só regras públicas)", async () => {
    const r = await receber("carla-2", "carla@exemplo.com", "Reserva do salão", "FAIL");
    expect(await conversa(r.conversaId!)).toMatchObject({
      condominioId: condo,
      moradorId: null,
      estado: "ia",
    });
  });

  test("urgência no assunto: alerta o síndico e não chama o agente", async () => {
    const r = await receber("eva-1", "eva@exemplo.com", "Cheiro de gás no hall", "PASS");
    expect(r.alerta?.regra).toBe("gas");
    expect(r.agente).toBeNull();
    expect(await conversa(r.conversaId!)).toMatchObject({
      prioridade: "critica",
      estado: "aguardando_sindico",
    });
  });
});
