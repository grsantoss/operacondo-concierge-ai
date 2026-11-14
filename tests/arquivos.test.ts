import { expect, test } from "bun:test";
import { nomeSeguro } from "../src/server/arquivos";

test("nome de arquivo não escapa do caminho do cliente", () => {
  expect(nomeSeguro("../../outro-cliente/x.pdf")).toBe("outro-cliente-x.pdf");
  expect(nomeSeguro("Foto do vazamento (1).JPG")).toBe("Foto-do-vazamento-1-.JPG");
  expect(nomeSeguro("ação.pdf")).toBe("acao.pdf");
  expect(nomeSeguro("...")).toBe("arquivo");
});
