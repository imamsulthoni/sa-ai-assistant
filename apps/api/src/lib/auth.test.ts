import { describe, expect, it, vi } from "vitest";

vi.mock("./prisma.js", () => ({ prisma: {} }));

import { extractBearerToken, signAuthToken, verifyAuthToken } from "./auth.js";

describe("extractBearerToken", () => {
  it("extracts token from Bearer scheme", () => {
    expect(extractBearerToken("Bearer my-token-123")).toBe("my-token-123");
    expect(extractBearerToken("bearer my-token-123")).toBe("my-token-123");
  });

  it("returns null for invalid or missing header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Basic abcdef")).toBeNull();
  });
});

describe("signAuthToken and verifyAuthToken", () => {
  it("signs and verifies a valid token payload", async () => {
    const user = { id: "user_test_1", tokenVersion: 0 };
    const token = await signAuthToken(user);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const payload = await verifyAuthToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user_test_1");
    expect(payload?.tokenVersion).toBe(0);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("returns null on invalid token string", async () => {
    const payload = await verifyAuthToken("invalid.token.here");
    expect(payload).toBeNull();
  });
});
