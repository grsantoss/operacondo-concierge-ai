/** O que vai para o Langfuse e o Sentry sai sem CPF, telefone e segredo do webhook. */
import { expect, test } from "bun:test";
import { mascararDado } from "../src/server/observability";

test("mascara strings em qualquer profundidade; ids e números ficam", () => {
  const id = "3ee301ca-4b6f-43f8-ba7c-4c185f004680";
  const evento = {
    message: "Falhou ao enviar para (11) 98123-0506",
    extra: { conversa: id, tentativas: 3, texto: ["CPF 529.982.247-25", null] },
    request: { url: "https://app.exemplo.com/api/whatsapp/zapi/abc123SEGREDO?x=1" },
  };
  expect(mascararDado(evento)).toEqual({
    message: "Falhou ao enviar para [telefone]",
    extra: { conversa: id, tentativas: 3, texto: ["CPF [CPF]", null] },
    request: { url: "https://app.exemplo.com/api/whatsapp/zapi/[segredo]?x=1" },
  });
});

test("não mexe em objetos que não são simples (Date, Error)", () => {
  const d = new Date();
  expect(mascararDado({ d }).d).toBe(d);
});
