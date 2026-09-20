import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

async function main() {
  const username = (getArg("username") ?? process.env.ADMIN_USERNAME ?? "admin").trim();
  const email = (getArg("email") ?? process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = (getArg("password") ?? process.env.ADMIN_PASSWORD ?? "").trim();

  if (!username) {
    throw new Error("ADMIN_USERNAME is required");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Valid ADMIN_EMAIL is required");
  }
  if (!password || password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        tokenVersion: { increment: 1 },
      },
    });
    console.log(`[create-admin] User ${updated.email} (${updated.username}) diperbarui menjadi SUPER_ADMIN.`);
  } else {
    const created = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log(`[create-admin] SUPER_ADMIN baru berhasil dibuat: ${created.email} (${created.username})`);
  }
}

main()
  .catch((error) => {
    console.error("[create-admin] Gagal membuat admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
