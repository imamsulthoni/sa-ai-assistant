import { describe, expect, it, vi } from "vitest";
import type { DocumentSummary } from "./api.js";
import { waitForDocumentReady } from "./documents.js";

type DocumentStatus = DocumentSummary["status"];

function makeDocument(status: DocumentStatus, error: string | null = null): DocumentSummary {
  return {
    id: "doc-1",
    title: "BRD.pdf",
    fileType: "PDF",
    fileSize: 10,
    status,
    storageUrl: "https://example.com/brd.pdf",
    createdAt: new Date().toISOString(),
    error,
  };
}

describe("waitForDocumentReady", () => {
  it("resolves as soon as the document is ready", async () => {
    const fetchDocument = vi.fn().mockResolvedValue({ document: makeDocument("READY") });
    const result = await waitForDocumentReady("session-1", "doc-1", {
      fetchDocument: fetchDocument as never,
      intervalMs: 1,
    });
    expect(result.status).toBe("READY");
    expect(fetchDocument).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while the document is processing", async () => {
    const fetchDocument = vi
      .fn()
      .mockResolvedValueOnce({ document: makeDocument("PROCESSING") })
      .mockResolvedValueOnce({ document: makeDocument("UPLOADING") })
      .mockResolvedValue({ document: makeDocument("READY") });
    const result = await waitForDocumentReady("session-1", "doc-1", {
      fetchDocument: fetchDocument as never,
      intervalMs: 1,
    });
    expect(result.status).toBe("READY");
    expect(fetchDocument).toHaveBeenCalledTimes(3);
  });

  it("throws with the document error when processing failed", async () => {
    const fetchDocument = vi
      .fn()
      .mockResolvedValue({ document: makeDocument("FAILED", "OCR gagal") });
    await expect(
      waitForDocumentReady("session-1", "doc-1", {
        fetchDocument: fetchDocument as never,
        intervalMs: 1,
      }),
    ).rejects.toThrow("OCR gagal");
  });

  it("throws a timeout error after exhausting attempts", async () => {
    const fetchDocument = vi.fn().mockResolvedValue({ document: makeDocument("PROCESSING") });
    await expect(
      waitForDocumentReady("session-1", "doc-1", {
        fetchDocument: fetchDocument as never,
        intervalMs: 1,
        timeoutMs: 3,
      }),
    ).rejects.toThrow(/batas waktu/);
  });
});
