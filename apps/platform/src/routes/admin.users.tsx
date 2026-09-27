import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  KeyRound,
  Pencil,
  Plus,
  Power,
  Search,
} from "lucide-react";
import { Alert } from "#/components/base/alert";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Input } from "#/components/base/input";
import { Modal } from "#/components/base/modal";
import { Skeleton } from "#/components/base/skeleton";
import {
  createAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  toggleAdminUserStatus,
  updateAdminUser,
  type AdminUser,
  type UserRole,
} from "#/lib/api";
import { useAuth } from "#/modules/auth/auth-context";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
import { relativeTime } from "#/lib/time";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  // State Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        search: search.trim() || undefined,
        role: roleFilter === "ALL" ? undefined : roleFilter,
      };
      const res = await listAdminUsers(filters);
      setUsers(res.users);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Manajemen Pengguna
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Kelola akun pengguna, hak akses Super Admin, reset password, dan status aktif/non-aktif.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} />
          <span>Tambah Pengguna</span>
        </Button>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* Filter & Pencarian */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama pengguna atau email…"
            className="ps-8 text-xs"
          />
          <Search
            size={14}
            className="pointer-events-none absolute top-2.5 left-2.5 text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="role-filter" className="text-xs text-muted-foreground">
            Role:
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "ALL")}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            <option value="ALL">Semua Role</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="USER">User</option>
          </select>
        </div>
      </div>

      {/* Tabel Pengguna */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Project</th>
                <th className="px-4 py-3">Terdaftar</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Tidak ada pengguna yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "transition-colors hover:bg-muted",
                        !u.isActive && "bg-muted opacity-75",
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{u.username}</span>
                          {isSelf && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Anda
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.role === "SUPER_ADMIN" ? (
                          <Badge tone="dark" className="text-[10px]">
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[10px]">
                            User
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 font-medium text-success">
                            <span className="size-1.5 rounded-full bg-success" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-destructive">
                            <span className="size-1.5 rounded-full bg-destructive" />
                            Non-aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground font-mono">
                        {u.projectCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {relativeTime(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditTarget(u)}
                            title="Edit pengguna"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetTarget(u)}
                            title="Reset password"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setStatusTarget(u)}
                            title={
                              isSelf
                                ? "Tidak dapat mengubah status akun sendiri"
                                : u.isActive
                                  ? "Non-aktifkan akun"
                                  : "Aktifkan akun"
                            }
                            className={cn(
                              "rounded p-1 transition-colors",
                              isSelf
                                ? "cursor-not-allowed text-muted-foreground"
                                : u.isActive
                                  ? "text-destructive hover:bg-destructive/10"
                                  : "text-success hover:bg-success/10",
                            )}
                          >
                            <Power size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pengguna */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void loadUsers();
        }}
      />

      {/* Modal Edit Pengguna */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          isSelf={currentUser?.id === editTarget.id}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
          onUpdated={() => {
            setEditTarget(null);
            void loadUsers();
          }}
        />
      )}

      {/* Modal Reset Password */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          open={resetTarget !== null}
          onClose={() => setResetTarget(null)}
          onSuccess={() => {
            setResetTarget(null);
          }}
        />
      )}

      {/* Modal Toggle Status */}
      {statusTarget && (
        <ToggleStatusModal
          user={statusTarget}
          open={statusTarget !== null}
          onClose={() => setStatusTarget(null)}
          onToggled={() => {
            setStatusTarget(null);
            void loadUsers();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Modal: Tambah Pengguna
// ---------------------------------------------------------------------------

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim() || !password) {
      setError("Semua bidang wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await createAdminUser({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      notify.success(`Pengguna ${username.trim()} berhasil dibuat.`);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("USER");
      onCreated();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Pengguna Baru"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={busy}
          >
            {busy ? "Menyimpan…" : "Simpan Pengguna"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Username
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="johndoe"
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Password Awal
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={busy}
            className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            <option value="USER">User (Pengguna Standar)</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-Modal: Edit Pengguna
// ---------------------------------------------------------------------------

function EditUserModal({
  user,
  isSelf,
  open,
  onClose,
  onUpdated,
}: {
  user: AdminUser;
  isSelf: boolean;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updateAdminUser(user.id, {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      notify.success("Data pengguna berhasil diperbarui.");
      onUpdated();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Pengguna: ${user.username}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={busy}
          >
            {busy ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Username
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={busy || (isSelf && user.role === "SUPER_ADMIN")}
            className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            <option value="USER">User (Pengguna Standar)</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          {isSelf && user.role === "SUPER_ADMIN" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Anda tidak dapat menurunkan role akun sendiri.
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-Modal: Reset Password
// ---------------------------------------------------------------------------

function ResetPasswordModal({
  user,
  open,
  onClose,
  onSuccess,
}: {
  user: AdminUser;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    setBusy(true);
    try {
      await resetAdminUserPassword(user.id, password);
      notify.success(`Password untuk ${user.username} berhasil direset.`);
      onSuccess();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reset Password: ${user.username}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={busy}
          >
            {busy ? "Mereset…" : "Reset Password"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Mereset password akan membatalkan semua sesi login aktif pengguna ini sehingga pengguna
        wajib login ulang dengan password baru.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Password Baru
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          required
          disabled={busy}
        />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-Modal: Toggle Status (Aktif / Non-aktif)
// ---------------------------------------------------------------------------

function ToggleStatusModal({
  user,
  open,
  onClose,
  onToggled,
}: {
  user: AdminUser;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nextStatus = !user.isActive;

  async function handleToggle() {
    setError(null);
    setBusy(true);
    try {
      await toggleAdminUserStatus(user.id, nextStatus);
      notify.success(
        `Pengguna ${user.username} berhasil ${nextStatus ? "diaktifkan" : "dinonaktifkan"}.`,
      );
      onToggled();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={nextStatus ? "Aktifkan Akun Pengguna?" : "Non-aktifkan Akun Pengguna?"}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant={nextStatus ? "solid" : "danger"}
            size="sm"
            onClick={() => void handleToggle()}
            disabled={busy}
          >
            {busy ? "Memproses…" : nextStatus ? "Aktifkan Akun" : "Non-aktifkan Akun"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {nextStatus
          ? `Pengguna “${user.username}” (${user.email}) akan diaktifkan kembali dan dapat masuk ke sistem.`
          : `Pengguna “${user.username}” (${user.email}) akan dinonaktifkan. Seluruh sesi aktif akan segera terputus dan pengguna tidak dapat masuk sampai diaktifkan kembali. Seluruh data project tetap aman.`}
      </p>
    </Modal>
  );
}
