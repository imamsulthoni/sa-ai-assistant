import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument, type DocumentSummary } from "#/lib/api";
import { COPY } from "#/lib/copy";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
import { ATTACHMENT_MAX_UPLOAD_BYTES, ATTACHMENT_MAX_UPLOAD_LABEL } from "#/lib/upload";

const TRANSIENT_STATUSES = new Set(["UPLOADING", "PROCESSING"]);

function messageOf(error: unknown): string {
  return describeError(error);
}

export function useDocuments(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const previousStatuses = useRef(new Map<string, DocumentSummary["status"]>());

  const documentsQuery = useQuery({
    queryKey: ["session", sessionId, "documents"],
    queryFn: () => listDocuments(sessionId ?? "").then((response) => response.documents),
    enabled: sessionId !== null,
    refetchInterval: (query) =>
      query.state.data?.some((document) => TRANSIENT_STATUSES.has(document.status)) ? 4000 : false,
  });
  const documents = documentsQuery.data ?? [];
  const loading = documentsQuery.isPending;
  const loaded = documentsQuery.isSuccess;
  const fetching = documentsQuery.isFetching;
  const error = actionError ?? (documentsQuery.isError ? messageOf(documentsQuery.error) : null);

  useEffect(() => {
    const data = documentsQuery.data;
    if (!data) return;
    for (const document of data) {
      const previous = previousStatuses.current.get(document.id);
      if (previous && previous !== document.status) {
        if (document.status === "READY") notify.success(`${document.title} siap digunakan.`);
        if (document.status === "FAILED") notify.error(`${document.title} gagal diproses.`);
      }
      previousStatuses.current.set(document.id, document.status);
    }
  }, [documentsQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: ({ files }: { files: FileList | File[] }) => {
      if (!sessionId) throw new Error("A conversation is required to upload documents");
      const all = Array.from(files);
      const oversized = all.filter((file) => file.size > ATTACHMENT_MAX_UPLOAD_BYTES);
      if (oversized.length) {
        const message = COPY.errors.attachmentTooLarge(oversized[0].name, ATTACHMENT_MAX_UPLOAD_LABEL);
        setActionError(message);
        notify.error(message);
      }
      const allowed = all.filter((file) => file.size <= ATTACHMENT_MAX_UPLOAD_BYTES);
      return Promise.all(allowed.map((file) => uploadDocument(sessionId, file)));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const snapshot = Array.from(files);
      setActionError(null);
      await uploadMutation.mutateAsync({ files: snapshot });
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

  return {
    documents,
    loading,
    loaded,
    fetching,
    uploading: uploadMutation.isPending,
    error,
    upload,
    remove,
  };
}
