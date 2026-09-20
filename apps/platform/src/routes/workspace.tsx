import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "#/lib/auth-storage";

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
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
