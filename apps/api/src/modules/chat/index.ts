import { Hono } from "hono";

export const chatModule = new Hono();

chatModule.get("/", (c) => {
  return c.json({
    module: "chat",
    message: "Chat module is ready",
  });
});
