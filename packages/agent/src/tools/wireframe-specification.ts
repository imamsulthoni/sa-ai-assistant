import { createTool } from "@anvia/core";
import { z } from "zod";

export const createWireframeSpecificationTool = createTool({
  name: "create_wireframe_specification",
  description: "Convert BRD screen requirements into deterministic wireframe specifications.",
  inputSchema: z.object({
    brdScreens: z.string().min(1),
  }),
  execute: async ({ brdScreens }) => ({
    brdScreens,
    status: "ready_for_model_completion" as const,
    screens: [],
    note: "The Figma plugin is responsible for drawing the returned specification.",
  }),
});
