import { Hono } from "hono";
import { getAuthUser, requireSuperAdmin } from "../../lib/auth.js";
import {
  AdminCreateUserSchema,
  AdminResetPasswordSchema,
  AdminToggleStatusSchema,
  AdminUpdateUserSchema,
} from "./schema.js";
import {
  AdminActionError,
  createAdminUser,
  listAdminUsers,
  resetUserPassword,
  toggleUserStatus,
  updateAdminUser,
} from "./service.js";

export const adminModule = new Hono();

adminModule.use("*", requireSuperAdmin);

adminModule.get("/users", async (c) => {
  const search = c.req.query("search")?.trim();
  const roleQuery = c.req.query("role")?.trim();
  const role = roleQuery === "SUPER_ADMIN" || roleQuery === "USER" ? roleQuery : undefined;

  const users = await listAdminUsers({ search, role });
  return c.json({ users });
});

adminModule.post("/users", async (c) => {
  const parsed = AdminCreateUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid user payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    const user = await createAdminUser(parsed.data);
    return c.json({ user }, 201);
  } catch (error) {
    if (error instanceof AdminActionError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400 | 409);
    }
    return c.json({ error: "Gagal membuat user" }, 500);
  }
});

adminModule.patch("/users/:id", async (c) => {
  const auth = getAuthUser(c);
  const targetId = c.req.param("id");
  const parsed = AdminUpdateUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid update payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    const user = await updateAdminUser(targetId, parsed.data, auth.id);
    return c.json({ user });
  } catch (error) {
    if (error instanceof AdminActionError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400 | 404 | 409);
    }
    return c.json({ error: "Gagal memperbarui user" }, 500);
  }
});

adminModule.post("/users/:id/password", async (c) => {
  const targetId = c.req.param("id");
  const parsed = AdminResetPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid password payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    await resetUserPassword(targetId, parsed.data.password);
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminActionError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400 | 404);
    }
    return c.json({ error: "Gagal mereset password" }, 500);
  }
});

adminModule.patch("/users/:id/status", async (c) => {
  const auth = getAuthUser(c);
  const targetId = c.req.param("id");
  const parsed = AdminToggleStatusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid status payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    const user = await toggleUserStatus(targetId, parsed.data.isActive, auth.id);
    return c.json({ user });
  } catch (error) {
    if (error instanceof AdminActionError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400 | 404);
    }
    return c.json({ error: "Gagal mengubah status user" }, 500);
  }
});
