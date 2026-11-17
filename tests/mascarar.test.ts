/** LGPD: CPF e telefone saem dos textos enviados para fora. */
import { expect, test } from "bun:test";
import { mascarar, mascararCpf } from "../src/lib/mascarar";

test("mascara CPF e telefone nos formatos comuns", () => {
  const casos: [string, string][] = [
    ["meu cpf é 529.982.247-25", "meu cpf é [CPF]"],
    ["cpf 52998224725", "cpf [CPF]"],
    ["liga 11 98123-0506", "liga [telefone]"],
    ["(11) 98123-0506", "[telefone]"],
    ["(11)981230506", "[telefone]"],
    ["+55 11 98123-0506", "[telefone]"],
    ["5511981230506", "[telefone]"],
    ["11981230506", "[telefone]"],
    ["fone 3333-4444", "fone [telefone]"],
  ];
  for (const [entrada, saida] of casos) expect(mascarar(entrada)).toBe(saida);
});

test("não mexe em valores, códigos, unidades e horários", () => {
  for (const t of [
    "orçamento R$ 1.500,00, protocolo 12345678",
    "apto 302, bloco B, D-2405",
    "número qualquer 12345678901",
    "Art. 12, assembleia de 15/03/2024 às 22h",
  ])
    expect(mascarar(t)).toBe(t);
});

test("documentos: só o CPF sai; telefone da portaria fica", () => {
  expect(mascararCpf("Síndico CPF 529.982.247-25, portaria (11) 3333-4444")).toBe(
    "Síndico CPF [CPF], portaria (11) 3333-4444",
  );
});
