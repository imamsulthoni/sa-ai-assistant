import { createContext, useContext, useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "#/components/base/button";
import { APP_NAME, APP_TAGLINE, COPY } from "#/lib/copy";

type ChatShellProps = {
  sidebar: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const CloseMobileSidebarContext = createContext<(() => void) | null>(null);

/** Tombol tutup di sidebar mobile; null saat sidebar tampil di desktop. */
export function useCloseMobileSidebar(): (() => void) | null {
  return useContext(CloseMobileSidebarContext);
}

export function ChatShell({ sidebar, title, actions, children }: ChatShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="h-full">{sidebar}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label={COPY.shell.closeMenu}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
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
        <header className="z-20 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 transition-colors dark:border-slate-800 dark:bg-slate-900">
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

            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900">
                <Sparkles size={14} />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight">{APP_NAME}</span>
                <span className="hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-500 sm:inline dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  {APP_TAGLINE}
                </span>
              </div>
            </div>

            {title && (
              <>
                <span className="mx-1 hidden h-3.5 w-px bg-slate-200 md:block dark:bg-slate-800" />
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
