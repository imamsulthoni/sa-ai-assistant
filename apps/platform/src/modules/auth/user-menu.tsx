import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "./auth-context";
import { Badge } from "#/components/base/badge";
import { cn } from "#/lib/utils";

function initialsOf(value: string): string {
  const parts = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "U";
}

export function UserMenu({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!user) return null;

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className={cn("relative inline-block text-left", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        title={`${user.username} (${user.email})`}
      >
        <span className="grid size-7 cursor-pointer place-items-center rounded-full border border-border bg-foreground text-[11px] font-semibold text-background transition-opacity hover:opacity-90">
          {initialsOf(user.username)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg ring-1 ring-foreground/5 focus:outline-none">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-semibold text-foreground">
                {user.username}
              </span>
              {isSuperAdmin ? (
                <Badge tone="dark" className="text-[10px] uppercase">
                  Super Admin
                </Badge>
              ) : (
                <Badge tone="neutral" className="text-[10px] uppercase">
                  User
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>

          <div className="py-1">
            {isSuperAdmin && (
              <Link
                to="/admin/users"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Users size={14} className="text-muted-foreground" />
                <span>Manajemen Pengguna</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut size={14} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
