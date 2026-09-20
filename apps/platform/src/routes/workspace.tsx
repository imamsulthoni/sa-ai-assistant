import { useEffect } from "react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "#/lib/auth-storage";
import { applyStoredTheme, applyTheme } from "#/lib/theme";
import { useSettings } from "#/modules/settings/hooks/use-settings";

/**
 * Layout untuk area workspace. Halaman daftar project hidup di
 * `workspace.index.tsx`, sedangkan halaman project di
 * `workspace.projects.$projectId.tsx`; keduanya dirender lewat Outlet ini.
 */
export const Route = createFileRoute("/workspace")({
  beforeLoad: () => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({ to: "/" });
    }
    applyStoredTheme();
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  return <Outlet />;
}