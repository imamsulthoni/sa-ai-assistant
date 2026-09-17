import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getSettings, updateSettings, type Settings, type SettingsResponse } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSettings() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });
  const settings = settingsQuery.data?.settings ?? null;
  const modelDefaults = settingsQuery.data?.modelDefaults ?? null;
  const hasServerApiKey = settingsQuery.data?.hasServerApiKey ?? false;
  const loading = settingsQuery.isPending;
  const error = actionError ?? (settingsQuery.isError ? messageOf(settingsQuery.error) : null);

  const saveMutation = useMutation({
    mutationFn: (input: Partial<Settings> & { apiKey?: string | null }) => updateSettings(input),
    onSuccess: (response) => {
      queryClient.setQueryData<SettingsResponse>(["settings"], (previous) => ({
        settings: response.settings,
        modelDefaults: previous?.modelDefaults ?? {
          aiModel: "",
          easyModel: "",
          mediumModel: "",
          hardModel: "",
          baseUrl: "",
        },
        hasServerApiKey: previous?.hasServerApiKey ?? false,
      }));
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const save = useCallback(
    async (input: Partial<Settings> & { apiKey?: string | null }) => {
      setActionError(null);
      await saveMutation.mutateAsync(input);
    },
    [saveMutation],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  return {
    settings,
    modelDefaults,
    hasServerApiKey,
    loading,
    saving: saveMutation.isPending,
    error,
    save,
    refresh,
  };
}
