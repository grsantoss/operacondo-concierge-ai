/**
 * Prompt e mensagens do agente. A ordem favorece o cache: system (por condomínio) → documentos
 * (bloco com cache) → contexto do morador e conversa (mudam a cada resposta).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { COLECAO_NOME, type Contexto } from "@/server/agent/contexto";
import { mascarar, mascararCpf } from "@/lib/mascarar";

/** O modelo começa a resposta com isto quando os documentos não respondem (vai ao síndico). */
export const SEM_BASE = "[SEM_BASE]";

import agente from "./AGENT.md" with { type: "text" };
import baseDocumental from "./rules/base-documental.md" with { type: "text" };
import canalEmail from "./rules/canal-email.md" with { type: "text" };
import canalWhatsapp from "./rules/canal-whatsapp.md" with { type: "text" };
import seguranca from "./rules/seguranca.md" with { type: "text" };
import abrirDemanda from "./skills/abrir-demanda.md" with { type: "text" };
import cadastroMorador from "./skills/cadastro-morador.md" with { type: "text" };
import demandasDoMorador from "./skills/demandas-do-morador.md" with { type: "text" };
import emailNaoMorador from "./skills/email-nao-morador.md" with { type: "text" };
import escalarSindico from "./skills/escalar-sindico.md" with { type: "text" };
import escolherCondominio from "./skills/escolher-condominio.md" with { type: "text" };

const TOM = {
  formal: "formal e respeitoso (trate por senhor/senhora)",
  cordial: "cordial e acolhedor, sem exageros",
  direto: "direto e objetivo, sem rodeios",
};

/** Categorias de quem escreve sem ser morador (do protótipo do canal de e-mail). */
export const CATEGORIAS_EMAIL = [
  "urgente",
  "manutenção",
  "reclamação",
  "fornecedor",
  "financeiro",
  "assembleia",
  "reserva",
  "informativo",
] as const;

type Canal = Contexto["conversa"]["canal"];

/** Regras: sempre no prompt, numeradas nesta ordem em "Como responder". */
const REGRAS = (canal: Canal) => [
  baseDocumental,
  canal === "email" ? canalEmail : canalWhatsapp,
  seguranca,
];

/**
 * Skills: procedimentos de cada situação. ponytail: a escolha depende só do canal, para o
 * sistema (e o cache dos documentos depois dele) ser o mesmo em toda conversa do condomínio
 * naquele canal; filtrar por morador quebraria o cache.
 */
const SKILLS: { texto: string; canais: Canal[] }[] = [
  { texto: abrirDemanda, canais: ["whatsapp", "email"] },
  { texto: escalarSindico, canais: ["whatsapp", "email"] },
  { texto: cadastroMorador, canais: ["whatsapp", "email"] },
  { texto: escolherCondominio, canais: ["whatsapp", "email"] },
  { texto: demandasDoMorador, canais: ["whatsapp", "email"] },
  { texto: emailNaoMorador, canais: ["email"] },
];

/** Linhas de conteúdo do Markdown: sem títulos (#) nem comentários (<!-- -->). */
function linhas(md: string): string[] {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"));
}

/** Troca {{nome}}; variável que faltar é erro de programação, não texto vazio. */
export function preencher(md: string, vars: Record<string, string>): string {
  return md.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`Variável {{${k}}} sem valor no prompt.`);
    return vars[k]!;
  });
}

export function sistema(ctx: Contexto): string {
  const canal = ctx.conversa.canal;
  const vars = {
    condominio: ctx.condominio,
    assistente: canal === "email" ? "de e-mail" : "de WhatsApp",
    tom: TOM[ctx.config.tom],
    SEM_BASE,
    categorias: CATEGORIAS_EMAIL.map((c) => `[${c}]`).join(", "),
  };
  const regras = REGRAS(canal)
    .flatMap(linhas)
    .map((l, i) => `${i + 1}. ${preencher(l.replace(/^- /, ""), vars)}`);
  const skills = SKILLS.filter((k) => k.canais.includes(canal))
    .flatMap((k) => linhas(k.texto))
    .map((l) => `${preencher(l, vars)}\n`);
  const instrucoes = ctx.instrucoes?.trim();
  return `${linhas(preencher(agente, vars)).join("\n")}

Como responder:
${regras.join("\n")}

Ferramentas:
${skills.join("")}${instrucoes ? `\nOrientações do síndico (não substituem os documentos):\n${instrucoes}\n` : ""}`;
}

/** Um bloco de documento por arquivo; cada trecho é um bloco citável (citações da API). */
export function blocosDocumentos(ctx: Contexto): Anthropic.DocumentBlockParam[] {
  const blocos = ctx.documentos.map(
    (d): Anthropic.DocumentBlockParam => ({
      type: "document",
      title: `${COLECAO_NOME[d.colecao]}: ${d.titulo}`,
      context:
        [
          d.vigenteDesde ? `Vigente desde ${d.vigenteDesde.split("-").reverse().join("/")}.` : "",
          d.revogaTitulo ? `Revoga, no que alterar: ${d.revogaTitulo}.` : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      source: {
        type: "content",
        // CPF sai; telefone fica (contato da portaria, do zelador… que o síndico publicou).
        content: d.trechos.map((t) => ({ type: "text" as const, text: mascararCpf(t.texto) })),
      },
      citations: { enabled: true },
    }),
  );
  // Cache até aqui: system + documentos se repetem em toda resposta do condomínio.
  if (blocos.length) blocos.at(-1)!.cache_control = { type: "ephemeral" };
  return blocos;
}

function textoMensagem(m: Contexto["historico"][number]): string {
  if (m.tipo === "audio")
    return m.transcricao ? `[áudio] ${m.transcricao}` : "[áudio sem transcrição]";
  if (m.tipo === "imagem") return m.texto ? `[foto] ${m.texto}` : "[foto]";
  if (m.tipo === "documento") return `[arquivo] ${m.texto ?? ""}`.trim();
  return m.assunto ? `Assunto: ${m.assunto}\n${m.texto ?? ""}` : (m.texto ?? "");
}

/**
 * Conversa no formato da API: morador = user; IA, síndico e mensagens automáticas = assistant.
 * Mensagens seguidas do mesmo lado são juntadas; a primeira precisa ser do morador.
 */
export function mensagens(ctx: Contexto): Anthropic.MessageParam[] {
  const turnos: { role: "user" | "assistant"; texto: string }[] = [];
  for (const m of ctx.historico) {
    const role = m.direcao === "entrada" ? "user" : "assistant";
    const prefixo = m.autor === "sindico" ? "(síndico) " : "";
    // LGPD: CPF e telefone que o morador (ou o síndico) escreveu não vão para o modelo.
    const texto = prefixo + mascarar(textoMensagem(m));
    if (!texto.trim()) continue;
    const ultimo = turnos.at(-1);
    if (ultimo?.role === role) ultimo.texto += `\n${texto}`;
    else if (turnos.length || role === "user") turnos.push({ role, texto });
  }

  const morador = [
    ctx.morador
      ? `Morador: ${ctx.morador.nome} (cadastro ${ctx.morador.cadastro}).`
      : "Morador ainda não identificado (sem cadastro): use só regras gerais, nada de dados de unidade.",
    ctx.demandas.length
      ? `Demandas já abertas nesta conversa: ${ctx.demandas.map((d) => `${d.codigo} (${d.titulo})`).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const docs = blocosDocumentos(ctx);
  const aviso = docs.length
    ? morador
    : `${morador}\nNão há documentos do condomínio disponíveis: para qualquer regra, use ${SEM_BASE}.`;

  return turnos.map((t, i) => ({
    role: t.role,
    content:
      i === 0
        ? [
            ...docs,
            { type: "text" as const, text: `${aviso}\n\nMensagens do morador:\n${t.texto}` },
          ]
        : t.texto,
  }));
}
