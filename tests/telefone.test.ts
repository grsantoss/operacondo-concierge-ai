import { expect, test } from "bun:test";
import { formatarTelefone, paraE164 } from "../src/lib/telefone";

test("normaliza telefones para E.164", () => {
  expect(paraE164("+55 11 99988-1204")).toBe("+5511999881204");
  expect(paraE164("(11) 99988-1204")).toBe("+5511999881204");
  expect(paraE164("011 99988-1204")).toBe("+5511999881204");
  expect(paraE164("11 3333-4444")).toBe("+551133334444");
  expect(paraE164("+1 415 555 0100")).toBe("+14155550100");
  expect(paraE164("—")).toBeNull();
  expect(paraE164("123")).toBeNull();
  expect(paraE164("")).toBeNull();
});

test("formata para exibir", () => {
  expect(formatarTelefone("+5511999881204")).toBe("+55 11 99988-1204");
  expect(formatarTelefone("+551133334444")).toBe("+55 11 3333-4444");
  expect(formatarTelefone("+14155550100")).toBe("+14155550100");
  expect(formatarTelefone(null)).toBe("—");
});
