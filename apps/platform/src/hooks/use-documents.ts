import { useCallback, useEffect, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument, type DocumentSummary } from "#/lib/api";

export function useDocuments(sessionId: string | null) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    try {
      setDocuments((await listDocuments(sessionId)).documents);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!documents.some((document) => ["UPLOADING", "PROCESSING"].includes(document.status))) {
      return;
    }

    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [documents, refresh]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          if (!sessionId) {
            throw new Error("A conversation is required to upload documents");
          }
          await uploadDocument(sessionId, file);
        }
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to upload document");
      } finally {
        setUploading(false);
      }
    },
    [refresh, sessionId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!sessionId) return;

      try {
        await deleteDocument(sessionId, id);
        setDocuments((current) => current.filter((document) => document.id !== id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to delete document");
      }
    },
    [sessionId],
  );

  return { documents, loading, uploading, error, upload, remove };
}
