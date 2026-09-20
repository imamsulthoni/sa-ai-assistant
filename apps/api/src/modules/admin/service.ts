import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../lib/password.js";
import type { PublicUser } from "../../lib/auth.js";
import { toPublicUser } from "../auth/service.js";
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
} from "./schema.js";

export class AdminActionError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
    this.code = code;
  }
}

export type AdminUserItem = PublicUser & {
  projectCount: number;
};

export async function listAdminUsers(options: {
  search?: string;
  role?: "SUPER_ADMIN" | "USER";
}): Promise<AdminUserItem[]> {
  const where: {
    role?: "SUPER_ADMIN" | "USER";
    OR?: Array<{ username: { contains: string; mode: "insensitive" } } | { email: { contains: string; mode: "insensitive" } }>;
  } = {};

  if (options.role) {
    where.role = options.role;
  }

  if (options.search?.trim()) {
    const s = options.search.trim();
    where.OR = [
      { username: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Hitung jumlah project per user
  const userIds = users.map((u) => u.id);
  const projectGroups = await prisma.project.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _count: { id: true },
  });

  const projectCountMap = new Map<string, number>();
  for (const item of projectGroups) {
    projectCountMap.set(item.userId, item._count.id);
  }

  return users.map((u) => ({
    ...toPublicUser(u),
    projectCount: projectCountMap.get(u.id) ?? 0,
  }));
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<AdminUserItem> {
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingEmail) {
    throw new AdminActionError("Email sudah terdaftar", 409, "email_taken");
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existingUsername) {
    throw new AdminActionError("Username sudah digunakan", 409, "username_taken");
  }

  const passwordHash = await hashPassword(input.password);

  const created = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: true,
    },
  });

  return {
    ...toPublicUser(created),
    projectCount: 0,
  };
}

export async function updateAdminUser(
  targetId: string,
  input: AdminUpdateUserInput,
  currentUserId: string,
): Promise<AdminUserItem> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
  });
  if (!target) {
    throw new AdminActionError("User tidak ditemukan", 404, "user_not_found");
  }

  // Jika mengubah role
  if (input.role && input.role !== target.role) {
    if (target.id === currentUserId && input.role !== "SUPER_ADMIN") {
      throw new AdminActionError("Tidak dapat menurunkan role akun Anda sendiri", 400, "cannot_demote_self");
    }

    if (target.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new AdminActionError("Tidak dapat menurunkan role Super Admin terakhir di sistem", 400, "last_super_admin");
      }
    }
  }

  // Cek duplikasi email jika email diubah
  if (input.email && input.email !== target.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new AdminActionError("Email sudah digunakan", 409, "email_taken");
    }
  }

  // Cek duplikasi username jika username diubah
  if (input.username && input.username !== target.username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existingUsername) {
      throw new AdminActionError("Username sudah digunakan", 409, "username_taken");
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: {
      username: input.username,
      email: input.email,
      role: input.role,
    },
  });

  const projectCount = await prisma.project.count({
    where: { userId: targetId },
  });

  return {
    ...toPublicUser(updated),
    projectCount,
  };
}

export async function resetUserPassword(targetId: string, newPassword: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
  });
  if (!target) {
    throw new AdminActionError("User tidak ditemukan", 404, "user_not_found");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: targetId },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 }, // Mengeluarkan sesi aktif user
    },
  });
}

export async function toggleUserStatus(
  targetId: string,
  isActive: boolean,
  currentUserId: string,
): Promise<AdminUserItem> {
  if (targetId === currentUserId && !isActive) {
    throw new AdminActionError("Tidak dapat menonaktifkan akun Anda sendiri", 400, "cannot_deactivate_self");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
  });
  if (!target) {
    throw new AdminActionError("User tidak ditemukan", 404, "user_not_found");
  }

  // Jika menonaktifkan super admin, pastikan bukan super admin aktif terakhir
  if (target.role === "SUPER_ADMIN" && !isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw new AdminActionError("Tidak dapat menonaktifkan Super Admin aktif terakhir di sistem", 400, "last_super_admin");
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: {
      isActive,
      // Jika dinonaktifkan, batalkan semua token yang sedang berjalan
      tokenVersion: isActive ? target.tokenVersion : { increment: 1 },
    },
  });

  const projectCount = await prisma.project.count({
    where: { userId: targetId },
  });

  return {
    ...toPublicUser(updated),
    projectCount,
  };
}
