import { useEffect, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Logo } from "#/components/brand/logo";
import { APP_TAGLINE, COPY } from "#/lib/copy";

type ChatShellProps = {
  sidebar?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

const SIDEBAR_STORAGE_KEY = "sa.sidebarCollapsed";

function initialSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ChatShell({ sidebar, headerAction, children }: ChatShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // localStorage may be unavailable; the toggle still works for this session
    }
  }, [sidebarCollapsed]);

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      {!sidebarCollapsed && (
        <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-sidebar md:block">
          <div className="flex h-full flex-col">{sidebar}</div>
        </aside>
      )}

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={COPY.shell.closeMenu}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-rise absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-border/70 bg-sidebar shadow-lifted">
            <div className="flex items-center justify-end p-2.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label={COPY.shell.closeMenu}
                className="text-muted-foreground"
              >
                <X size={16} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 px-2 pb-2">{sidebar}</div>
          </aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-card/70 px-4 backdrop-blur md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={COPY.shell.openMenu}
          >
            <Menu size={20} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? COPY.shell.showSidebar : COPY.shell.hideSidebar}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? COPY.shell.showSidebar : COPY.shell.hideSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </Button>

          <div className="flex min-w-0 items-center gap-2.5">
            <Logo markClassName="size-7" />
            <span className="hidden rounded-full border border-border/70 bg-muted/60 px-2.5 py-0.5 text-xs font-normal text-muted-foreground sm:inline">
              {APP_TAGLINE}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1">{headerAction}</div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </section>
    </main>
  );
}
