import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes password and verifies successfully", async () => {
    const raw = "secretPassword123";
    const hashed = await hashPassword(raw);
    expect(hashed).toMatch(/^\$argon2id\$/);

    const valid = await verifyPassword(raw, hashed);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("wrongPassword", hashed);
    expect(invalid).toBe(false);
  });
});
