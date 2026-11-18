/**
 * E-mail transacional pela Amazon SES (decisão #43). Ligado por `SES_REMETENTE`; sem ele, o
 * envio é pulado com um log (dev e testes). Credenciais: `SES_ACCESS_KEY`/`SES_SECRET_KEY` ou a
 * cadeia padrão da AWS (ex.: papel IAM da máquina).
 */
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

let cliente: SESv2Client | undefined;

export const emailConfigurado = () => Boolean(process.env.SES_REMETENTE);

export interface Email {
  para: string[];
  assunto: string;
  texto: string;
}

/** Envia em texto puro. Devolve false se o e-mail não está configurado ou não há destinatário. */
export async function enviarEmail({ para, assunto, texto }: Email): Promise<boolean> {
  const destino = [...new Set(para.filter(Boolean))];
  if (!destino.length) return false;
  if (!emailConfigurado()) {
    console.warn(`[email] SES_REMETENTE vazio: "${assunto}" não foi enviado`);
    return false;
  }
  cliente ??= new SESv2Client({
    region: process.env.SES_REGION ?? "sa-east-1",
    credentials: process.env.SES_ACCESS_KEY
      ? {
          accessKeyId: process.env.SES_ACCESS_KEY,
          secretAccessKey: process.env.SES_SECRET_KEY ?? "",
        }
      : undefined,
  });
  await cliente.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.SES_REMETENTE,
      Destination: { ToAddresses: destino },
      Content: {
        Simple: {
          Subject: { Data: assunto, Charset: "UTF-8" },
          Body: { Text: { Data: texto, Charset: "UTF-8" } },
        },
      },
    }),
  );
  return true;
}
