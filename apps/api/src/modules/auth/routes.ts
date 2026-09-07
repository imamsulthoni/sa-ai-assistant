import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { loginSchema } from "./schema.js";

export const authRoutes = new Hono().post(
  "/login",
  zValidator("json", loginSchema),
  (c) => c.json({ ok: true, user: c.req.valid("json").email }),
);
