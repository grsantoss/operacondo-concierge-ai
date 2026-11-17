/**
 * Prepara o Langfuse de dev no Postgres e no S3 do próprio projeto: cria o banco "langfuse" e o
 * bucket "langfuse" se faltarem. Idempotente. Usado por `bun run langfuse:up`.
 */
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const psql = (sql: string) =>
  Bun.spawnSync(
    ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-tAc", sql],
    { stderr: "inherit" },
  );
const existe = psql("select 1 from pg_database where datname = 'langfuse'");
if (existe.exitCode !== 0) throw new Error("Postgres fora do ar: rode `bun run db:up` antes.");
if (existe.stdout.toString().trim() !== "1") {
  if (psql("create database langfuse").exitCode !== 0) throw new Error("Falhou ao criar o banco.");
  console.info("banco langfuse criado");
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "dev",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "dev",
  },
});
try {
  await s3.send(new HeadBucketCommand({ Bucket: "langfuse" }));
} catch {
  await s3.send(new CreateBucketCommand({ Bucket: "langfuse" }));
  console.info("bucket langfuse criado");
}
