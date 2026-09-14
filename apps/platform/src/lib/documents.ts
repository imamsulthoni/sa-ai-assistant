import { getDocument, type DocumentSummary } from "./api";

export type WaitForDocumentOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  fetchDocument?: typeof getDocument;
};

/**
 * Polls a document until its content is usable, or throws with a clear reason.
 * The fetcher is injectable so the waiting logic can be unit tested offline.
 */
export async function waitForDocumentReady(
  sessionId: string,
  documentId: string,
  options: WaitForDocumentOptions = {},
): Promise<DocumentSummary> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const fetchDocument = options.fetchDocument ?? getDocument;
  const attempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { document } = await fetchDocument(sessionId, documentId);
    if (document.status === "READY" || document.status === "PENDING_CONFIRMATION") {
      return document;
    }
    if (document.status === "FAILED") {
      throw new Error(document.error ?? "Pemrosesan dokumen gagal.");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Pemrosesan dokumen melebihi batas waktu.");
}
