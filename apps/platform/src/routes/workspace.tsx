import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Layout untuk area workspace. Halaman daftar project hidup di
 * `workspace.index.tsx`, sedangkan halaman project di
 * `workspace.projects.$projectId.tsx`; keduanya dirender lewat Outlet ini.
 */
export const Route = createFileRoute("/workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
