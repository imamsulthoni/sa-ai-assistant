import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getSettings, updateSettings, type Settings } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSettings() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings().then((response) => response.settings),
  });
  const settings = settingsQuery.data ?? null;
  const loading = settingsQuery.isPending;
  const error = actionError ?? (settingsQuery.isError ? messageOf(settingsQuery.error) : null);

  const saveMutation = useMutation({
    mutationFn: (input: Partial<Settings> & { apiKey?: string }) => updateSettings(input),
    onSuccess: (response) => {
      queryClient.setQueryData(["settings"], response.settings);
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const save = useCallback(
    async (input: Partial<Settings> & { apiKey?: string }) => {
      setActionError(null);
      await saveMutation.mutateAsync(input);
    },
    [saveMutation],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  return { settings, loading, saving: saveMutation.isPending, error, save, refresh };
}
