/**
 * Arquivos no S3 (SeaweedFS em dev; S3/R2 em produção). Caminho sempre
 * {tenant_id}/{condominio_id}/{colecao}/… — nunca montado com dado vindo do navegador sem limpar.
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cliente: S3Client | undefined;
let bucketPronto: Promise<void> | undefined;

function s3(): S3Client {
  cliente ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true, // SeaweedFS/MinIO; S3 da AWS aceita também
    // Sem chave nas variáveis: usa a cadeia padrão da AWS (ex.: papel IAM da máquina).
    credentials: process.env.S3_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY ?? "",
        }
      : undefined,
  });
  return cliente;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET não definida (veja .env.example)");
  return b;
}

/** Cria o bucket na primeira gravação (dev). Em produção ele já existe e o HEAD basta. */
function garantirBucket(): Promise<void> {
  bucketPronto ??= s3()
    .send(new HeadBucketCommand({ Bucket: bucket() }))
    .then(
      () => undefined,
      () =>
        s3()
          .send(new CreateBucketCommand({ Bucket: bucket() }))
          .then(() => undefined),
    )
    .catch((e) => {
      bucketPronto = undefined;
      throw e;
    });
  return bucketPronto;
}

/** Nome de arquivo seguro para usar no caminho. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-120);
  return limpo || "arquivo";
}

export async function gravarArquivo(caminho: string, corpo: Uint8Array, tipo: string) {
  await garantirBucket();
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: caminho, Body: corpo, ContentType: tipo }),
  );
}

/** Link temporário (15 min) para o navegador baixar o arquivo. */
export function linkTemporario(caminho: string, nomeDownload?: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: caminho,
      ResponseContentDisposition: nomeDownload
        ? `inline; filename*=UTF-8''${encodeURIComponent(nomeDownload)}`
        : undefined,
    }),
    { expiresIn: 900 },
  );
}

/** Lê o arquivo inteiro (worker: ingestão de documentos). */
export async function lerArquivo(caminho: string): Promise<Uint8Array<ArrayBuffer>> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: caminho }));
  if (!r.Body) throw new Error(`Arquivo vazio no S3: ${caminho}`);
  return new Uint8Array(await r.Body.transformToByteArray());
}

export async function apagarArquivo(caminho: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: caminho }));
}

/** Apaga tudo sob um prefixo (ex.: `{tenant_id}/` na exclusão do cliente). */
export async function apagarPasta(prefixo: string) {
  if (!prefixo.endsWith("/")) throw new Error("prefixo precisa terminar em /");
  let token: string | undefined;
  do {
    const r = await s3()
      .send(
        new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefixo, ContinuationToken: token }),
      )
      .catch((e: { name?: string }) => {
        // Bucket ainda não criado (nenhum arquivo gravado): não há o que apagar.
        if (e.name === "NoSuchBucket") return null;
        throw e;
      });
    if (!r) return;
    const chaves = (r.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (chaves.length)
      await s3().send(
        new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: chaves, Quiet: true } }),
      );
    token = r.NextContinuationToken;
  } while (token);
}
