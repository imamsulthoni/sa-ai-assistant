import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { chatModule } from "./modules/chat/router.js";

const app = new Hono();

app.use("/chat/*", cors({ origin: "http://localhost:3000" }));
app.get("/", (c) => c.json({ name: "sa-ai-assistant-api", status: "ok" }));
app.route("/chat", chatModule);

serve(
  { fetch: app.fetch, port: Number(process.env.API_PORT ?? 8000) },
  (info) => console.log(`Server is running on http://localhost:${info.port}`),
);
