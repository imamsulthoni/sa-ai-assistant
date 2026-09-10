import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";

export function createTemplateStructureTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "get_template_structure",
    description: "Resolve the approved BRD template for the current scope.",
    inputSchema: z.object({
      userId: z.string().min(1),
      sessionId: z.string().min(1),
      projectId: z.string().min(1).optional(),
    }),
    execute: async (input) => ({
      templateStructure: await resolved.getTemplateStructure(input),
      source: "adapter_or_builtin" as const,
    }),
  });
}

export const getTemplateStructureTool = createTemplateStructureTool();
