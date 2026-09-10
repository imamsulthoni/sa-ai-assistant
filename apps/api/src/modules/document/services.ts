import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/sa-ai-assistant`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadDocument(file: File) {
  const objectKey = `${randomUUID()}-${file.name}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
    }),
  );

  return objectKey;
}

export async function deleteDocument(objectKey: string) {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}

export async function downloadDocument(objectKey: string) {
  const response = await r2.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
  if (!response.Body) throw new Error("R2 returned an empty document body");
  return Buffer.from(await response.Body.transformToByteArray());
}

export function documentUrl(objectKey: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is required to process documents");
  }
  return `${baseUrl}/${objectKey}`;
}
