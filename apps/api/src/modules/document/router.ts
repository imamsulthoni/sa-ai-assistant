import { Hono } from "hono";

export const documentModule = new Hono();

documentModule.get("/", (c) => {
  return c.json({
    module: "document",
    message: "Document module is ready",
  });
});
