import { createContext, useContext, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { Button } from "#/components/base/button";
import { APP_NAME, APP_TAGLINE, COPY } from "#/lib/copy";
import { cn } from "#/lib/utils";

type ChatShellProps = {
  sidebar: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const CloseMobileSidebarContext = createContext<(() => void) | null>(null);

const SIDEBAR_STORAGE_KEY = "sa.sidebarOpen";

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Tombol tutup di sidebar mobile; null saat sidebar tampil di desktop. */
export function useCloseMobileSidebar(): (() => void) | null {
  return useContext(CloseMobileSidebarContext);
}

export function ChatShell({ sidebar, title, actions, children }: ChatShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPreference);

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Storage bisa tidak tersedia (private mode); preferensi cukup in-memory.
      }
      return next;
    });
  };

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-background font-sans text-foreground antialiased">
      {/* Width dianimasikan, konten sidebar lebar tetap agar tidak terlipat saat transisi. */}
      <aside
        aria-hidden={!sidebarOpen}
        className={cn(
          "hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out lg:block",
          sidebarOpen ? "w-64" : "w-0",
        )}
      >
        <div className="h-full w-64">{sidebar}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label={COPY.shell.closeMenu}
            className="absolute inset-0 bg-overlay backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">
            <CloseMobileSidebarContext.Provider value={() => setMobileOpen(false)}>
              {sidebar}
            </CloseMobileSidebarContext.Provider>
          </div>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 transition-colors">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={COPY.shell.openMenu}
            >
              <Menu size={16} />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? COPY.shell.hideSidebar : COPY.shell.showSidebar}
              title={sidebarOpen ? COPY.shell.hideSidebar : COPY.shell.showSidebar}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </Button>

            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded bg-foreground text-background shadow-xs">
                <Sparkles size={14} />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight">{APP_NAME}</span>
                <span className="hidden rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground sm:inline">
                  {APP_TAGLINE}
                </span>
              </div>
            </div>

            {title && (
              <>
                <span className="mx-1 hidden h-3.5 w-px bg-border md:block" />
                <div className="hidden min-w-0 items-center gap-2 md:flex">{title}</div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">{actions}</div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </section>
    </main>
  );
}
