import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "#/components/ui/button";

type ChatShellProps = {
  sidebar?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

export function ChatShell({ sidebar, headerAction, children }: ChatShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-white text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r bg-muted md:block">
        <div className="flex h-full flex-col">{sidebar}</div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r bg-muted shadow-xl">
            <div className="flex items-center justify-end p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground"
              >
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 px-2 pb-2">{sidebar}</div>
          </aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </Button>

          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="truncate">System Analyst AI Assistant</span>
            <span className="hidden rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground sm:inline">
              GPT
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1">{headerAction}</div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </section>
    </main>
  );
}
