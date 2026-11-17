/**
 * Configuração do agente por condomínio (`agente_config`, uma linha por condomínio).
 * Sem linha gravada, valem os padrões abaixo.
 */
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { exigirCliente } from "@/server/auth/contexto";
import { schema as s, withTenant } from "@/server/db";

// Lista fixa: usar `s.tom.enumValues` aqui levaria o módulo do banco para o navegador.
const TONS = [
  "formal",
  "cordial",
  "direto",
] as const satisfies readonly (typeof s.tom.enumValues)[number][];

const texto = z.string().trim().max(1000).default("");

/** O que vai em `opcoes` (jsonb). Campo novo entra aqui com default: linhas antigas continuam válidas. */
const Opcoes = z.object({
  assinatura: z.string().trim().max(120).default("— OperaCondo Concierge"),
  reservas: z.boolean().default(true),
  horarios: z.boolean().default(true),
  orcamentos: z.boolean().default(false),
  escalarAuto: z.boolean().default(true),
  reclamacoes: z
    .object({
      auto: z.boolean().default(true),
      prioridade: z.enum(["Normal", "Alta", "Crítica"]).default("Normal"),
      escalar: z.enum(["reincidente", "outro_morador", "sempre"]).default("reincidente"),
      instrucoes: texto,
    })
    .prefault({}),
  manutencao: z
    .object({
      canal: z.enum(["whatsapp", "portal", "ambos"]).default("whatsapp"),
      exigirFoto: z.boolean().default(true),
      aprovarAcimaLimite: z.boolean().default(true),
      instrucoes: texto,
    })
    .prefault({}),
});

export const ConfigAgente = z.object({
  tom: z.enum(TONS).default("cordial"),
  /** R$; vazio = sem limite. */
  limiteAprovacao: z.number().min(0).max(1_000_000).nullable().default(500),
  opcoes: Opcoes.prefault({}),
});
export type ConfigAgente = z.infer<typeof ConfigAgente>;

const Condo = z.object({ condominioId: z.string().uuid() });

export const obterConfigAgente = createServerFn({ method: "GET" })
  .inputValidator(Condo)
  .handler(async ({ data }): Promise<ConfigAgente> => {
    const { tenantId } = await exigirCliente();
    const [c] = await withTenant(tenantId, (tx) =>
      tx.select().from(s.agenteConfig).where(eq(s.agenteConfig.condominioId, data.condominioId)),
    );
    // safeParse: se o jsonb tiver algo fora do formato, volta aos padrões em vez de quebrar a tela.
    const r = ConfigAgente.safeParse(c ?? {});
    return r.success ? r.data : ConfigAgente.parse({});
  });

export const salvarConfigAgente = createServerFn({ method: "POST" })
  .inputValidator(Condo.extend({ config: ConfigAgente }))
  .handler(async ({ data: { condominioId, config } }) => {
    const { tenantId } = await exigirCliente();
    await withTenant(tenantId, async (tx) => {
      const [c] = await tx
        .select({ id: s.condominios.id })
        .from(s.condominios)
        .where(eq(s.condominios.id, condominioId));
      if (!c) throw new Error("Condomínio não encontrado.");
      const valores = { ...config, atualizadoEm: new Date() };
      await tx
        .insert(s.agenteConfig)
        .values({ condominioId, tenantId, ...valores })
        .onConflictDoUpdate({ target: s.agenteConfig.condominioId, set: valores });
    });
  });
