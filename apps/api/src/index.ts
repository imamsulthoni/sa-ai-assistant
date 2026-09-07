import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { chatModule } from "./modules/chat/index.js";
import { documentModule } from "./modules/document/index.js";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/chat", chatModule);
app.route("/document", documentModule);

serve(
  {
    fetch: app.fetch,
    port: 8000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
