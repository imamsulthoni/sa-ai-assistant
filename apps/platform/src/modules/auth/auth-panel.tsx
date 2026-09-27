import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, LogOut, Mail, User as UserIcon } from "lucide-react";
import { Alert } from "#/components/base/alert";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Input } from "#/components/base/input";
import { Logo } from "#/components/brand/logo";
import { describeError } from "#/lib/errors";
import { useAuth } from "./auth-context";

export type AuthMode = "login" | "register";

type AuthPanelProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
};

export function AuthPanel({ mode, onModeChange }: AuthPanelProps) {
  const navigate = useNavigate();
  const { user, loading, login, register, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
  }, [mode]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Mohon isi email dan password.");
      return;
    }
    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      void navigate({ to: "/workspace" });
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setError("Username minimal 3 karakter.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      setError("Username hanya boleh huruf, angka, underscore (_), atau strip (-).");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Email tidak valid.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setBusy(true);
    try {
      await register({ username: cleanUsername, email: cleanEmail, password });
      void navigate({ to: "/workspace" });
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="auth" className="auth-panel flex min-h-full items-center justify-center bg-card px-6 py-8 text-foreground sm:px-10 sm:py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center lg:hidden">
          <Logo />
        </div>
        {loading ? (
          <p className="text-center text-xs text-muted-foreground">
            Memeriksa sesi…
          </p>
        ) : user ? (
          <div className="rounded-xl border border-border bg-muted p-6">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.username}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <Badge
                tone={user.role === "SUPER_ADMIN" ? "dark" : "neutral"}
                className="ml-auto text-[10px] uppercase"
              >
                {user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
              </Badge>
            </div>

            <Button
              className="mt-5 w-full justify-center"
              onClick={() => void navigate({ to: "/workspace" })}
            >
              Buka Workspace <ArrowRight size={14} />
            </Button>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 text-xs font-medium text-destructive transition-colors hover:text-destructive/80"
            >
              <LogOut size={13} /> Keluar
            </button>
          </div>
        ) : (
          <div className="bg-card p-1">
            <div className="mb-6 flex rounded-lg border border-border bg-muted p-0.5">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onModeChange(item)}
                  className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === item
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>

            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {mode === "login"
                ? "Gunakan email dan password untuk membuka workspace."
                : "Cukup username, email, dan password untuk mulai menyusun BRD."}
            </p>

            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={(e) => void handleLogin(e)} className="mt-4 space-y-3">
                <Field label="Email" icon={<Mail size={13} />}>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                <Field label="Password" icon={<Lock size={13} />}>
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                <Button type="submit" disabled={busy} className="w-full justify-center">
                  {busy ? "Memproses…" : "Masuk"}
                  {!busy && <ArrowRight size={14} />}
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleRegister(e)} className="mt-4 space-y-3">
                <Field label="Username" icon={<UserIcon size={13} />}>
                  <Input
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                <Field label="Email" icon={<Mail size={13} />}>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                  <Field label="Password (min 8 karakter)" icon={<Lock size={13} />}>
                  <Input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                <Field label="Konfirmasi password" icon={<Lock size={13} />}>
                  <Input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="ps-7"
                    disabled={busy}
                  />
                </Field>
                <Button type="submit" disabled={busy} className="w-full justify-center">
                  {busy ? "Mendaftarkan…" : "Daftar"}
                  {!busy && <ArrowRight size={14} />}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-2.5 left-2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
