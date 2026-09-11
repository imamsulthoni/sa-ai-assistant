import { useCallback, useEffect, useState } from "react";
import { getSettings, updateSettings, type Settings } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings((await getSettings()).settings);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (input: Partial<Settings> & { apiKey?: string }) => {
    setSaving(true);
    setError(null);
    try {
      setSettings((await updateSettings(input)).settings);
    } catch (caught) {
      setError(messageOf(caught));
      throw caught;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, save, refresh };
}
