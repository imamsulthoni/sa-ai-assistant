import { afterEach, describe, expect, it } from "vitest";
import { matchesVectorFilter } from "@anvia/core/vector-store";
import { documentUrl, documentVectorFilter, sanitizeFileName } from "./services.js";

describe("sanitizeFileName", () => {
  it("keeps the extension and slugifies the base", () => {
    expect(sanitizeFileName("User Story Cuti 2026.pdf")).toBe("User_Story_Cuti_2026.pdf");
  });

  it("handles names without an extension", () => {
    expect(sanitizeFileName("nota dinas")).toBe("nota_dinas");
  });

  it("falls back to 'file' when nothing usable remains", () => {
    expect(sanitizeFileName("***")).toBe("file");
  });

  it("lowercases the extension and strips unsafe characters", () => {
    expect(sanitizeFileName("BRD Final (v2).PDF")).toBe("BRD_Final_v2.pdf");
  });
});

describe("documentUrl", () => {
  const original = process.env.R2_PUBLIC_BASE_URL;

  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = original;
  });

  it("joins the base URL and encodes each path segment", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/bucket/";
    expect(documentUrl("abc/Berita Acara.pdf")).toBe(
      "https://cdn.example.com/bucket/abc/Berita%20Acara.pdf",
    );
  });

  it("throws when the base URL is missing", () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    expect(() => documentUrl("abc.pdf")).toThrow(/R2_PUBLIC_BASE_URL/);
  });
});

describe("documentVectorFilter", () => {
  it("matches only points of the requested document", () => {
    const filter = documentVectorFilter("doc-1");
    expect(matchesVectorFilter({ documentId: "doc-1" }, filter)).toBe(true);
    expect(matchesVectorFilter({ documentId: "doc-2" }, filter)).toBe(false);
  });
});
