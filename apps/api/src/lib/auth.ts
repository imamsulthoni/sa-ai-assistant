import type { Context, MiddlewareHandler } from "hono";
import { sign, verify } from "hono/jwt";
import { prisma } from "./prisma.js";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  isActive: boolean;
  tokenVersion: number;
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
};

export function jwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      return "test-jwt-secret-for-vitest-runner-only";
    }
    throw new Error("AUTH_JWT_SECRET or ENCRYPTION_KEY is required for JWT signing");
  }
  return secret;
}

export type JwtPayload = {
  sub: string;
  tokenVersion: number;
  exp: number;
  iat: number;
};

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export async function signAuthToken(user: { id: string; tokenVersion: number }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    tokenVersion: user.tokenVersion,
    iat: now,
    exp: now + SEVEN_DAYS_SECONDS,
  };
  return sign(payload, jwtSecret(), "HS256");
}

export async function verifyAuthToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = (await verify(token, jwtSecret(), "HS256")) as unknown as JwtPayload;
    if (!payload?.sub || typeof payload.tokenVersion !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1]!.trim() : null;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return c.json({ error: "Unauthorized: Missing or invalid token", code: "unauthorized" }, 401);
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return c.json({ error: "Unauthorized: Invalid or expired token", code: "unauthorized" }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      tokenVersion: true,
    },
  });

  if (!user || !user.isActive) {
    return c.json({ error: "Unauthorized: User is inactive or not found", code: "unauthorized" }, 401);
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    return c.json({ error: "Unauthorized: Session invalidated", code: "unauthorized" }, 401);
  }

  c.set("auth", user);
  await next();
};

export const requireSuperAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get("auth") as AuthUser | undefined;
  if (!user || user.role !== "SUPER_ADMIN") {
    return c.json({ error: "Forbidden: Super Admin access required", code: "forbidden" }, 403);
  }
  await next();
};

export function getAuthUser(c: Context): AuthUser {
  const user = c.get("auth") as AuthUser | undefined;
  if (!user) {
    throw new Error("getAuthUser called on unauthenticated request");
  }
  return user;
}
