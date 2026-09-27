import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  STORED_MESSAGE_MAX_CHARS,
  storedMessageChars,
  trimStoredMessage,
} from "../modules/chat/memory-prune.js";

/**
 * Memotong message memory agent yang melebihi batas karakter. Payload besar
 * (mis. seluruh BRD yang tersimpan sebelum output cap aktif) ikut ter-replay di
 * setiap turn sehingga membengkakkan konteks; script ini merapikannya.
 *
 * Jalankan: pnpm db:prune-agent-memory
 * Dry run : pnpm db:prune-agent-memory -- --dry-run
 */

const dryRun = process.argv.includes("--dry-run");
const maxChars = Number(process.env.MEMORY_MAX_CHARS ?? STORED_MESSAGE_MAX_CHARS);

async function main() {
  const rows = await prisma.agentMemoryMessage.findMany({
    select: { id: true, message: true },
    orderBy: { createdAt: "asc" },
  });

  let pruned = 0;
  let savedChars = 0;
  for (const row of rows) {
    const before = storedMessageChars(row.message);
    if (before <= maxChars) continue;
    const trimmed = trimStoredMessage(row.message, maxChars);
    const after = storedMessageChars(trimmed);
    if (after >= before) continue;
    pruned += 1;
    savedChars += before - after;
    if (!dryRun) {
      await prisma.agentMemoryMessage.update({
        where: { id: row.id },
        data: { message: trimmed as Prisma.InputJsonValue },
      });
    }
  }

  console.log(dryRun ? "[dry-run] prune selesai." : "Prune selesai.", {
    scanned: rows.length,
    pruned,
    savedChars,
    maxChars,
  });
}

main()
  .catch((error) => {
    console.error("Prune gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
