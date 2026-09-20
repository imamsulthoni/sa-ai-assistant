import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

vi.mock("../../lib/password.js", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed_${p}`),
  verifyPassword: vi.fn(async (plain: string, hash: string) => hash === `hashed_${plain}`),
}));

import { AuthError, loginUser, registerUser } from "./service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerUser", () => {
  it("creates a new user with USER role", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u_1",
      username: "budi",
      email: "budi@example.com",
      passwordHash: "hashed_password123",
      role: "USER",
      isActive: true,
      tokenVersion: 0,
      createdAt: new Date("2026-09-19T00:00:00Z"),
      updatedAt: new Date("2026-09-19T00:00:00Z"),
    });

    const res = await registerUser({
      username: "budi",
      email: "budi@example.com",
      password: "password123",
    });

    expect(res.user.id).toBe("u_1");
    expect(res.user.role).toBe("USER");
    expect(res.user.isActive).toBe(true);
    expect(typeof res.token).toBe("string");
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        username: "budi",
        email: "budi@example.com",
        passwordHash: "hashed_password123",
        role: "USER",
        isActive: true,
      },
    });
  });

  it("throws conflict if email is already taken", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "existing" });

    await expect(
      registerUser({
        username: "budi",
        email: "existing@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(AuthError);
  });
});

describe("loginUser", () => {
  it("returns token and user for valid credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u_2",
      username: "siti",
      email: "siti@example.com",
      passwordHash: "hashed_pass12345",
      role: "USER",
      isActive: true,
      tokenVersion: 0,
      createdAt: new Date("2026-09-19T00:00:00Z"),
      updatedAt: new Date("2026-09-19T00:00:00Z"),
    });

    const res = await loginUser({
      email: "siti@example.com",
      password: "pass12345",
    });

    expect(res.user.email).toBe("siti@example.com");
    expect(typeof res.token).toBe("string");
  });

  it("rejects when password does not match", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u_2",
      username: "siti",
      email: "siti@example.com",
      passwordHash: "hashed_correct_pass",
      role: "USER",
      isActive: true,
      tokenVersion: 0,
    });

    await expect(
      loginUser({
        email: "siti@example.com",
        password: "wrong_password",
      }),
    ).rejects.toThrow(AuthError);
  });

  it("rejects when user is inactive", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u_2",
      username: "siti",
      email: "siti@example.com",
      passwordHash: "hashed_pass12345",
      role: "USER",
      isActive: false,
      tokenVersion: 0,
    });

    await expect(
      loginUser({
        email: "siti@example.com",
        password: "pass12345",
      }),
    ).rejects.toThrow("Akun Anda dinonaktifkan");
  });
});
