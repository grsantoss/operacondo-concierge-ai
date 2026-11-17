/**
 * Sentry no navegador (erros de tela). Liga com VITE_SENTRY_DSN; sem ela, nada é enviado.
 * CPF e telefone mascarados; sem dados de usuário, cookies, cabeçalhos ou corpo de requisição.
 */
import * as Sentry from "@sentry/react";
import { mascarar } from "@/lib/mascarar";

function limpar<T>(dado: T): T {
  if (typeof dado === "string") return mascarar(dado) as T;
  if (Array.isArray(dado)) return dado.map(limpar) as T;
  if (dado && typeof dado === "object" && Object.getPrototypeOf(dado) === Object.prototype)
    return Object.fromEntries(Object.entries(dado).map(([k, v]) => [k, limpar(v)])) as T;
  return dado;
}

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let iniciado = false;

export function iniciarSentryNavegador() {
  if (iniciado || !dsn || typeof window === "undefined") return;
  iniciado = true;
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? "producao" : "dev",
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: (evento) => limpar(evento),
    beforeBreadcrumb: (b) => limpar(b),
  });
}

/** Erro mostrado na tela de erro (o React não o propaga para o Sentry sozinho). */
export function capturarErroNavegador(erro: unknown) {
  if (iniciado) Sentry.captureException(erro);
}
