import { Hono } from "hono";
import { LoginSchema, RegisterSchema } from "./schema.js";
import { AuthError, getMe, loginUser, registerUser } from "./service.js";
import { authMiddleware, getAuthUser } from "../../lib/auth.js";

export const authModule = new Hono();

authModule.post("/register", async (c) => {
  const parsed = RegisterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid registration payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    const result = await registerUser(parsed.data);
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400 | 409);
    }
    return c.json({ error: "Gagal mendaftar" }, 500);
  }
});

authModule.post("/login", async (c) => {
  const parsed = LoginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid login payload",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  try {
    const result = await loginUser(parsed.data);
    return c.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.status as 401 | 403);
    }
    return c.json({ error: "Gagal masuk" }, 500);
  }
});

authModule.get("/me", authMiddleware, async (c) => {
  const auth = getAuthUser(c);
  const user = await getMe(auth.id);
  if (!user) {
    return c.json({ error: "User not found", code: "user_not_found" }, 404);
  }
  return c.json({ user });
});
