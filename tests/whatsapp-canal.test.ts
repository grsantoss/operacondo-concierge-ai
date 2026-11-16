import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cifrar, decifrar } from "@/server/cripto";
import { ErroZapi, qrCodeZapi, statusZapi } from "@/server/whatsapp/zapi";

process.env.CREDENCIAIS_CHAVE ??= Buffer.alloc(32, 7).toString("base64");

describe("cripto", () => {
  test("cifra e decifra; cada cifragem é diferente", () => {
    const a = cifrar("segredo");
    expect(a).not.toContain("segredo");
    expect(a).not.toBe(cifrar("segredo"));
    expect(decifrar(a)).toBe("segredo");
  });

  test("dado adulterado não decifra", () => {
    const [v, iv, tag, dados] = cifrar("segredo").split(".");
    const outro = Buffer.from(dados!, "base64url");
    outro[0]! ^= 1;
    expect(() => decifrar([v, iv, tag, outro.toString("base64url")].join("."))).toThrow();
  });
});

describe("cliente Z-API", () => {
  let srv: ReturnType<typeof Bun.serve>;
  const vistos: { url: string; clientToken: string | null }[] = [];
  beforeAll(() => {
    srv = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url).pathname;
        vistos.push({ url, clientToken: req.headers.get("client-token") });
        if (url.includes("/token/ruim/"))
          return Response.json({ error: "null not allowed" }, { status: 400 });
        if (url.endsWith("/status"))
          return Response.json({ connected: false, error: "You are not connected." });
        if (url.endsWith("/qr-code/image")) return Response.json({ value: "iVBORw0KGgo=" });
        return new Response("?", { status: 404 });
      },
    });
    process.env.ZAPI_URL = `http://localhost:${srv.port}`;
  });
  afterAll(() => {
    srv.stop();
    delete process.env.ZAPI_URL;
  });

  test("monta a rota e manda o Client-Token", async () => {
    const st = await statusZapi({ instanceId: "INST1", token: "tok", clientToken: "ct" });
    expect(st.connected).toBe(false);
    expect(vistos.at(-1)).toEqual({ url: "/instances/INST1/token/tok/status", clientToken: "ct" });
  });

  test("QR Code vira data URL", async () => {
    expect(await qrCodeZapi({ instanceId: "INST1", token: "tok" })).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
  });

  test("credencial recusada vira mensagem amigável", async () => {
    const p = statusZapi({ instanceId: "INST1", token: "ruim" });
    expect(p).rejects.toBeInstanceOf(ErroZapi);
    expect(p).rejects.toThrow(/recusou as credenciais/);
  });
});
