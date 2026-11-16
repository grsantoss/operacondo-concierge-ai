/** Job da fila "alerta": avisa por WhatsApp os síndicos com número de alerta cadastrado. */
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { formatarTelefone } from "@/lib/telefone";
import { schema as s, withTenant } from "@/server/db";
import type { JobAlerta } from "@/server/queue";
import { REGRAS } from "@/server/pipeline/regras-urgencia";
import { credDoCanal, enviarTextoZapi } from "@/server/whatsapp/zapi";

export async function enviarAlerta(job: JobAlerta): Promise<number> {
  const regra = REGRAS.find((r) => r.id === job.regra);
  if (!regra) return 0;
  return withTenant(job.tenantId, async (tx) => {
    const [cv] = await tx
      .select({
        conversa: s.conversas,
        condominio: s.condominios.nome,
        morador: s.moradores.nome,
        canal: s.whatsappCanais,
      })
      .from(s.conversas)
      .innerJoin(s.whatsappCanais, eq(s.whatsappCanais.id, s.conversas.canalId))
      .leftJoin(s.condominios, eq(s.condominios.id, s.conversas.condominioId))
      .leftJoin(s.moradores, eq(s.moradores.id, s.conversas.moradorId))
      .where(eq(s.conversas.id, job.conversaId));
    if (!cv) return 0;
    const condominioId = cv.conversa.condominioId;
    // Síndicos/admins com número; quem tem lista de condomínios só recebe dos seus. Sem
    // condomínio definido (número desconhecido), avisa todos: não dá para saber de qual é.
    const destinos = await tx
      .select({ fone: s.membros.alertaE164 })
      .from(s.membros)
      .where(
        and(
          inArray(s.membros.papel, ["sindico", "admin"]),
          isNotNull(s.membros.alertaE164),
          condominioId
            ? sql`(cardinality(${s.membros.condominioIds}) = 0 or ${condominioId}::uuid = any(${s.membros.condominioIds}))`
            : undefined,
        ),
      );
    if (!destinos.length) return 0;
    const [ultima] = await tx
      .select({ texto: s.mensagens.texto })
      .from(s.mensagens)
      .where(and(eq(s.mensagens.conversaId, cv.conversa.id), eq(s.mensagens.direcao, "entrada")))
      .orderBy(desc(s.mensagens.criadoEm))
      .limit(1);
    const quem = [
      cv.condominio ?? "Condomínio ainda não definido",
      cv.morador ?? "número não cadastrado",
      formatarTelefone(cv.conversa.phoneE164),
    ].join(" • ");
    const base = (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
    const texto = [
      `🚨 Alerta de urgência: ${regra.rotulo}`,
      quem,
      ultima?.texto ? `Mensagem: "${ultima.texto.slice(0, 300)}"` : null,
      base ? `Abra a conversa: ${base}/app/agente` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const cred = credDoCanal(cv.canal);
    // Um destino com falha faz o job inteiro tentar de novo; quem já recebeu pode receber 2 vezes.
    for (const d of destinos) await enviarTextoZapi(cred, d.fone!, texto);
    return destinos.length;
  });
}
