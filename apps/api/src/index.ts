import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { authModule } from "./modules/auth/router.js";
import { authMiddleware } from "./lib/auth.js";
import { chatModule } from "./modules/chat/router.js";
import { sessionModule } from "./modules/session/router.js";
import { documentModule } from "./modules/document/router.js";
import { brdModule } from "./modules/brd/router.js";
import { settingsModule } from "./modules/settings/router.js";
import { searchModule } from "./modules/search/router.js";
import { projectModule } from "./modules/project/router.js";
import { adminModule } from "./modules/admin/router.js";

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono()
  .use(
    cors({
      origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
      allowHeaders: ["Content-Type", "Authorization", "x-user-id", "x-conversation-id"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["x-anvia-stream-protocol"],
    }),
  )
  .get("/", (c) => c.json({ name: "sa-ai-assistant-api", status: "ok" }))
  .route("/auth", authModule)
  .use(async (c, next) => {
    // Rute publik tidak memerlukan token
    const path = c.req.path;
    if (
      path === "/" ||
      path === "/auth/login" ||
      path === "/auth/register" ||
      c.req.method === "OPTIONS"
    ) {
      return next();
    }
    return authMiddleware(c, next);
  })
  .route("/chat", chatModule)
  .route("/sessions", sessionModule)
  .route("/projects", projectModule)
  .route("/documents", documentModule)
  .route("/brd", brdModule)
  .route("/settings", settingsModule)
  .route("/search", searchModule)
  .route("/admin", adminModule);

app.notFound((c) => c.json({ error: "Route not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

serve({ fetch: app.fetch, port: Number(process.env.API_PORT ?? 8000) }, (info) =>
  console.log(`Server is running on http://localhost:${info.port}`),
);
