import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  project: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../../lib/password.js", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed_${p}`),
}));

import {
  listAdminUsers,
  resetUserPassword,
  toggleUserStatus,
  updateAdminUser,
} from "./service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAdminUsers", () => {
  it("returns users mapped with their project counts", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u_1",
        username: "admin",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        isActive: true,
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
      {
        id: "u_2",
        username: "user1",
        email: "user1@example.com",
        role: "USER",
        isActive: true,
        createdAt: new Date("2026-09-02T00:00:00Z"),
      },
    ]);

    prismaMock.project.groupBy.mockResolvedValue([
      { userId: "u_1", _count: { id: 3 } },
    ]);

    const res = await listAdminUsers({});
    expect(res).toHaveLength(2);
    expect(res[0]?.username).toBe("admin");
    expect(res[0]?.projectCount).toBe(3);
    expect(res[1]?.username).toBe("user1");
    expect(res[1]?.projectCount).toBe(0);
  });
});

describe("updateAdminUser guards", () => {
  it("prevents demoting oneself", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin_id",
      role: "SUPER_ADMIN",
    });

    await expect(
      updateAdminUser("admin_id", { role: "USER" }, "admin_id"),
    ).rejects.toThrow("Tidak dapat menurunkan role akun Anda sendiri");
  });

  it("prevents demoting the last active super admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "other_admin",
      role: "SUPER_ADMIN",
    });
    prismaMock.user.count.mockResolvedValue(1);

    await expect(
      updateAdminUser("other_admin", { role: "USER" }, "my_admin_id"),
    ).rejects.toThrow("Super Admin terakhir");
  });
});

describe("toggleUserStatus guards", () => {
  it("prevents deactivating oneself", async () => {
    await expect(
      toggleUserStatus("my_id", false, "my_id"),
    ).rejects.toThrow("Tidak dapat menonaktifkan akun Anda sendiri");
  });

  it("prevents deactivating the last active super admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "target_admin",
      role: "SUPER_ADMIN",
    });
    prismaMock.user.count.mockResolvedValue(1);

    await expect(
      toggleUserStatus("target_admin", false, "caller_id"),
    ).rejects.toThrow("Super Admin aktif terakhir");
  });

  it("successfully deactivates user and increments tokenVersion", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "target_user",
      role: "USER",
      tokenVersion: 1,
    });
    prismaMock.user.update.mockResolvedValue({
      id: "target_user",
      username: "user_a",
      email: "user_a@example.com",
      role: "USER",
      isActive: false,
      createdAt: new Date("2026-09-01T00:00:00Z"),
    });
    prismaMock.project.count.mockResolvedValue(2);

    const res = await toggleUserStatus("target_user", false, "caller_id");
    expect(res.isActive).toBe(false);
    expect(res.projectCount).toBe(2);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "target_user" },
      data: {
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    });
  });
});

describe("resetUserPassword", () => {
  it("updates password hash and increments tokenVersion to invalidate sessions", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "target_user" });

    await resetUserPassword("target_user", "newSecretPassword123");

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "target_user" },
      data: {
        passwordHash: "hashed_newSecretPassword123",
        tokenVersion: { increment: 1 },
      },
    });
  });
});
