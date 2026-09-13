import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";

export function createTemplateStructureTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "get_template_structure",
    description:
      "Resolve the approved BRD template for the current scope. The active session and user are resolved automatically from the current conversation — never ask the user for a session ID or user ID.",
    inputSchema: z.object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      projectId: z.string().optional(),
    }),
    execute: async (input) => ({
      templateStructure: await resolved.getTemplateStructure(input),
      source: "adapter_or_builtin" as const,
    }),
  });
}

export const getTemplateStructureTool = createTemplateStructureTool();
