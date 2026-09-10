import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { chatModule } from "./modules/chat/router.js";
import { sessionModule } from "./modules/session/router.js";
import { documentModule } from "./modules/document/router.js";
import { brdModule } from "./modules/brd/router.js";
import { settingsModule } from "./modules/settings/router.js";
import { searchModule } from "./modules/search/router.js";

// const app = new Hono();
const app = new Hono()
  .use(
    cors({
      exposeHeaders: ["x-anvia-stream-protocol"],
    }),
  )
  .route("/chat", chatModule)
  .route("/sessions", sessionModule)
  .route("/documents", documentModule);

app.route("/brd", brdModule).route("/settings", settingsModule).route("/search", searchModule);

app.get("/", (c) => c.json({ name: "sa-ai-assistant-api", status: "ok" }));

serve({ fetch: app.fetch, port: Number(process.env.API_PORT ?? 8000) }, (info) =>
  console.log(`Server is running on http://localhost:${info.port}`),
);
