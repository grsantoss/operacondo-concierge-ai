/** Ferramenta `registrar_cadastro`. */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import type { Base } from "./index";

/** Texto do aceite que o agente apresenta antes do cadastro (versão gravada em `consentimentos`). */
export const LGPD_VERSAO = "whatsapp-v1";
export const LGPD_TEXTO =
  "Para te atender, a administração do condomínio guarda seu nome, unidade e telefone, conforme a LGPD. Você concorda?";
export const LGPD_VERSAO_EMAIL = "email-v1";
export const LGPD_TEXTO_EMAIL =
  "Para te atender, a administração do condomínio guarda seu nome, unidade e e-mail, conforme a LGPD. Você concorda?";

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

export function registrarCadastro({
  ctx,
  tenantId,
  condominioId,
  endereco,
  email,
  telefone,
  lgpd,
  tx,
}: Base) {
  return betaZodTool({
    name: "registrar_cadastro",
    description: `Cadastra o morador de um ${email ? "remetente" : "número"} desconhecido, como PENDENTE (o síndico aprova). Antes, pergunte nome, unidade, vínculo e peça o aceite exatamente com este texto: "${lgpd}". Só chame com o aceite dado.`,
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
      if (ctx.conversa.moradorId)
        return `Este ${email ? "remetente" : "número"} já tem cadastro neste condomínio.`;
      return tx(async (t) => {
        const unidades = await t
          .select()
          .from(s.unidades)
          .where(eq(s.unidades.condominioId, condominioId));
        const u = acharUnidade(unidade, unidades);
        // Sempre pendente: só o síndico aprova (nunca o modelo). Não passa pelo limite de
        // moradores do plano: o contato não se perde; o bloqueio vale no painel.
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
            email: email ? endereco : null,
          })
          .returning({ id: s.moradores.id });
        if (telefone)
          await t
            .insert(s.moradorContatos)
            .values({ tenantId, moradorId: m!.id, condominioId, phoneE164: telefone })
            .onConflictDoNothing();
        await t.insert(s.consentimentos).values({
          tenantId,
          ...(email ? { email: endereco } : { phoneE164: telefone }),
          finalidade: email ? "atendimento_email" : "atendimento_whatsapp",
          textoVersao: email ? LGPD_VERSAO_EMAIL : LGPD_VERSAO,
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
}
