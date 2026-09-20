import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";
import { Logo } from "#/components/brand/logo";
import { getStoredToken, getStoredUser } from "#/lib/auth-storage";
import { UserMenu } from "#/modules/auth/user-menu";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({ to: "/" });
    }
    const user = getStoredUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      throw redirect({ to: "/workspace" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden h-4 w-px bg-border sm:block" />
          <div className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:flex">
            <Shield size={14} className="text-muted-foreground" />
            <span>Panel Super Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/workspace"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft size={13} />
            <span>Ke Workspace</span>
          </Link>
          <span className="h-4 w-px bg-border" />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
