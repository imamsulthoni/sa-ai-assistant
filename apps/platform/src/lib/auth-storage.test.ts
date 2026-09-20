import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  setStoredSession,
} from "./auth-storage.js";
import type { PublicUser } from "./types.js";

const mockUser: PublicUser = {
  id: "user_123",
  username: "budi",
  email: "budi@example.com",
  role: "USER",
  isActive: true,
  createdAt: "2026-09-19T00:00:00.000Z",
};

// Polyfill in-memory localStorage untuk node test runner
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

beforeEach(() => {
  localStorage.clear();
});

describe("auth storage", () => {
  it("stores and retrieves token and user correctly", () => {
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();

    setStoredSession("test-token-xyz", mockUser);

    expect(getStoredToken()).toBe("test-token-xyz");
    expect(getStoredUser()).toEqual(mockUser);
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("test-token-xyz");
    expect(localStorage.getItem(AUTH_USER_KEY)).toContain("budi@example.com");
  });

  it("clears stored session", () => {
    setStoredSession("test-token-xyz", mockUser);
    clearStoredSession();

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});
