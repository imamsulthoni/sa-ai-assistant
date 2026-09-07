import { Hono } from "hono";
import { authRoutes } from "./modules/auth/routes.js";

const app = new Hono();

app.get("/", (c) => c.json({ name: "sa-ai-assistant-api" }));
app.route("/auth", authRoutes);

export default app;

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ fetch: app.fetch, port });
  console.log(`API listening on http://localhost:${port}`);
}
