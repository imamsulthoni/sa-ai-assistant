import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma.js";
import { documentQueue, templateQueue } from "../lib/queue.js";
import { DOCUMENTS_COLLECTION } from "../modules/document/services.js";

/**
 * Reset data testing: seluruh konten user (project, BRD, dokumen, sesi) dihapus
 * dari Postgres, Qdrant, dan R2. UserSetting sengaja dipertahankan agar
 * konfigurasi model tidak perlu diisi ulang.
 *
 * Jalankan: pnpm db:reset-data
 */

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function wipeR2() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is required");
  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const page = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );
    const keys = (page.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));
    if (keys.length) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
      deleted += keys.length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return deleted;
}

async function wipeQdrant() {
  const url = (process.env.QDRANT_URL ?? "http://127.0.0.1:6333").replace(/\/$/, "");
  const response = await fetch(`${url}/collections/${DOCUMENTS_COLLECTION}`, {
    method: "DELETE",
  });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Qdrant delete failed with status ${response.status}`);
}

async function wipeDatabase() {
  await prisma.$transaction([
    prisma.documentPage.deleteMany(),
    prisma.document.deleteMany(),
    prisma.brdVersion.deleteMany(),
    prisma.brdDocument.deleteMany(),
    prisma.brdFlowState.deleteMany(),
    prisma.agentMemoryMessage.deleteMany(),
    prisma.agentMemoryError.deleteMany(),
    prisma.agentMemorySession.deleteMany(),
    prisma.project.deleteMany(),
  ]);
}

/** BullMQ obliterate bisa menggantung bila worker masih memegang job. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

async function main() {
  const [documents, objectCount, collectionDeleted] = await Promise.all([
    prisma.document.count(),
    wipeR2(),
    wipeQdrant(),
  ]);
  await wipeDatabase();
  await Promise.all([
    withTimeout(documentQueue.obliterate({ force: true }).catch(() => undefined), 5000),
    withTimeout(templateQueue.obliterate({ force: true }).catch(() => undefined), 5000),
  ]);
  console.log("Reset selesai.", {
    documentsInDb: documents,
    r2ObjectsDeleted: objectCount,
    qdrantCollectionDeleted: collectionDeleted,
  });
}

main()
  .catch((error) => {
    console.error("Reset gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([documentQueue.close(), templateQueue.close()]);
    await prisma.$disconnect();
  });