import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument } from "#/lib/api";

const TRANSIENT_STATUSES = new Set(["UPLOADING", "PROCESSING"]);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDocuments(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["session", sessionId, "documents"],
    queryFn: () => listDocuments(sessionId ?? "").then((response) => response.documents),
    enabled: sessionId !== null,
    refetchInterval: (query) =>
      query.state.data?.some((document) => TRANSIENT_STATUSES.has(document.status)) ? 4000 : false,
  });
  const documents = documentsQuery.data ?? [];
  const loading = documentsQuery.isPending;
  const error = actionError ?? (documentsQuery.isError ? messageOf(documentsQuery.error) : null);

  const uploadMutation = useMutation({
    mutationFn: ({ files }: { files: FileList | File[] }) => {
      if (!sessionId) throw new Error("A conversation is required to upload documents");
      return Promise.all(Array.from(files).map((file) => uploadDocument(sessionId, file)));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setActionError(null);
      await uploadMutation.mutateAsync({ files });
    },
    [uploadMutation],
  );

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(sessionId ?? "", id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const remove = useCallback(
    async (id: string) => {
      if (!sessionId) return;
      setActionError(null);
      await removeMutation.mutateAsync(id);
    },
    [removeMutation, sessionId],
  );

  return { documents, loading, uploading: uploadMutation.isPending, error, upload, remove };
}
