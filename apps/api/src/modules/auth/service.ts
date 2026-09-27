import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAuthToken, type PublicUser } from "../../lib/auth.js";
import type { LoginInput, RegisterInput } from "./schema.js";

export class AuthError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  isActive: boolean;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingEmail) {
    throw new AuthError("Email sudah terdaftar", 409, "email_taken");
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existingUsername) {
    throw new AuthError("Username sudah digunakan", 409, "username_taken");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      role: "USER",
      isActive: true,
    },
  });

  const token = await signAuthToken(user);
  return {
    user: toPublicUser(user),
    token,
  };
}

export async function loginUser(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AuthError("Email atau password salah", 401, "invalid_credentials");
  }

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AuthError("Email atau password salah", 401, "invalid_credentials");
  }

  if (!user.isActive) {
    throw new AuthError("Akun Anda dinonaktifkan. Hubungi Super Admin.", 403, "user_inactive");
  }

  const token = await signAuthToken(user);
  return {
    user: toPublicUser(user),
    token,
  };
}

export async function getMe(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user ? toPublicUser(user) : null;
}
