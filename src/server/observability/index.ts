/**
 * Observabilidade do servidor (web e worker): OpenTelemetry → Langfuse (rastro da IA) e Sentry
 * (erros). Tudo opcional: sem as variáveis, nada é enviado. CPF e telefone são mascarados antes
 * de sair (mesmas regras de `mascarar.ts`). `llm_execucoes` continua sendo a fonte da cobrança.
 */
import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/node";
import { mascarar } from "@/lib/mascarar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// O segredo do webhook da Z-API vai na URL (/api/whatsapp/zapi/{segredo}).
const SEGREDO_WEBHOOK = /(\/api\/whatsapp\/zapi\/)[^/?#\s"']+/g;

/** Mascara CPF, telefone e o segredo do webhook em qualquer valor. Ids (UUID) ficam. */
export function mascararDado<T>(dado: T): T {
  if (typeof dado === "string")
    return (UUID.test(dado) ? dado : mascarar(dado).replace(SEGREDO_WEBHOOK, "$1[segredo]")) as T;
  if (Array.isArray(dado)) return dado.map(mascararDado) as T;
  if (dado && typeof dado === "object" && Object.getPrototypeOf(dado) === Object.prototype)
    return Object.fromEntries(Object.entries(dado).map(([k, v]) => [k, mascararDado(v)])) as T;
  return dado;
}

export const langfuseConfigurado = () =>
  !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

// Em dev o Vite recarrega módulos: o estado fica no globalThis para não iniciar duas vezes.
const g = globalThis as { __ocObs?: { sdk: NodeSDK | null } };

export function iniciarObservabilidade(servico: "web" | "worker") {
  if (g.__ocObs) return;
  g.__ocObs = { sdk: null };
  const environment = process.env.NODE_ENV === "production" ? "producao" : "dev";
  const release = process.env.npm_package_version;

  if (process.env.SENTRY_DSN)
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment,
      release,
      serverName: servico,
      // O OpenTelemetry é nosso (Langfuse); o Sentry fica só com os erros.
      enableOpenTelemetrySetup: false,
      // LGPD: corpo das requisições (mensagens do WhatsApp, cadastro), cookies de sessão,
      // cabeçalhos e dados de usuário não vão para o Sentry.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      beforeSend: (evento) => mascararDado(evento),
      beforeBreadcrumb: (b) => mascararDado(b),
    });

  if (langfuseConfigurado()) {
    const sdk = new NodeSDK({
      serviceName: `operacondo-${servico}`,
      spanProcessors: [
        new LangfuseSpanProcessor({
          environment,
          release,
          mask: ({ data }) => mascararDado(data),
        }),
      ],
    });
    sdk.start();
    g.__ocObs.sdk = sdk;
  }
}

/** Erro tratado que precisa chegar ao Sentry (sem DSN, não faz nada). */
export function capturarErro(erro: unknown, contexto?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) Sentry.captureException(erro, { extra: contexto });
}

export async function encerrarObservabilidade() {
  await g.__ocObs?.sdk?.shutdown();
  if (process.env.SENTRY_DSN) await Sentry.close(2000);
}

/**
 * Nota de qualidade no rastro do Langfuse (ex.: rascunho aprovado/editado/reescrito).
 * Nunca derruba quem chamou: falha só vai para o log.
 */
export async function registrarNota(traceId: string, nome: string, valor: string) {
  if (!langfuseConfigurado()) return;
  try {
    const lf = new LangfuseClient();
    lf.score.create({ traceId, name: nome, value: valor, dataType: "CATEGORICAL" });
    await lf.flush();
  } catch (e) {
    console.error("[observabilidade] nota não enviada ao Langfuse", e);
  }
}
