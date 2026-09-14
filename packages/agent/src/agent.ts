import { Agent, AnyTool, type AgentOptions } from "@anvia/core";
import { BRD_OUTPUT_GUIDANCE, SYSTEM_ANALYST_INSTRUCTIONS } from "./prompt/instructions.js";
import {
  CLARIFY_INSTRUCTIONS,
  GENERATE_INSTRUCTIONS,
  JUDGE_INSTRUCTIONS,
  QA_INSTRUCTIONS,
} from "./prompt/index.js";
import { createOpenAIModel } from "./provider/openai.js";
import { createModelRouter, type ModelRouterOptions } from "./provider/model-router.js";
import { createTavilyProvider } from "./provider/tavily.js";
import {
  answerBrdQuestionTool,
  draftBrdTool,
  elicitClarificationsTool,
  createActiveBrdTool,
  createSearchContextTool,
  createTemplateStructureTool,
  type AgentContextAdapters,
  getActiveBrdTool,
  searchContextTool,
  getTemplateStructureTool,
  modifyBrdTool,
  webTools,
} from "./tools/index.js";
import { createTracing } from "./tracing.js";

export interface CreateSystemAnalystAgentOptions {
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  memory?: AgentOptions["memory"];
  additionalTools?: AnyTool[];
  enableTracing?: boolean;
  modelRouter?: ModelRouterOptions;
  phase?: "CLARIFY" | "JUDGE" | "GENERATE" | "QA";
  contextAdapters?: AgentContextAdapters;
  systemPrompt?: string;
  templateInstruction?: string;
  allowedTools?: string[];
}

export type AgentPhaseName = "CLARIFY" | "JUDGE" | "GENERATE" | "QA";

/**
 * Tools each guided-flow phase may use. JUDGE only returns JSON, so it gets no
 * tools at all instead of inheriting the full toolkit.
 */
export const PHASE_ALLOWED_TOOLS: Record<"CLARIFY" | "GENERATE" | "QA", readonly string[]> = {
  CLARIFY: ["elicit_clarifications", "search_context", "get_active_brd", "web_search"],
  GENERATE: [
    "draft_brd",
    "search_context",
    "get_template_structure",
    "get_active_brd",
    "web_search",
  ],
  QA: ["answer_brd_question", "modify_brd", "search_context", "get_active_brd", "web_search"],
};

export function allowedToolsForPhase(phase?: AgentPhaseName): string[] | undefined {
  if (!phase) return undefined;
  if (phase === "JUDGE") return [];
  return [...PHASE_ALLOWED_TOOLS[phase]];
}

export function createSystemAnalystAgent(options: CreateSystemAnalystAgentOptions = {}): Agent {
  const tracing = createTracing();
  const tavily = createTavilyProvider();
  const router = options.modelRouter
    ? createModelRouter({
        ...options.modelRouter,
        apiKey: options.modelRouter.apiKey ?? options.apiKey,
        baseUrl: options.modelRouter.baseUrl ?? options.baseUrl,
      })
    : undefined;
  const model = router
    ? options.phase
      ? router.getModelForPhase(options.phase)
      : router.getModel()
    : createOpenAIModel({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        modelId: options.modelId,
      });

  const allTools = [
    draftBrdTool,
    elicitClarificationsTool,
    modifyBrdTool,
    answerBrdQuestionTool,
    ...(options.contextAdapters
      ? [
          createSearchContextTool(options.contextAdapters),
          createTemplateStructureTool(options.contextAdapters),
          createActiveBrdTool(options.contextAdapters),
        ]
      : [searchContextTool, getTemplateStructureTool, getActiveBrdTool]),
    ...webTools(tavily),
    ...(options.additionalTools ?? []),
  ];
  const phaseInstructions =
    options.phase === "CLARIFY"
      ? CLARIFY_INSTRUCTIONS
      : options.phase === "JUDGE"
        ? JUDGE_INSTRUCTIONS
        : options.phase === "GENERATE"
          ? GENERATE_INSTRUCTIONS
          : options.phase === "QA"
            ? QA_INSTRUCTIONS
            : "";
  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts and reviews BRDs and grounded specifications.",
    model,
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}\n\n${phaseInstructions}${options.templateInstruction ? `\n\n${options.templateInstruction}` : ""}${options.systemPrompt ? `\n\nAdditional user instructions:\n${options.systemPrompt}` : ""}`,
    tools: options.allowedTools
      ? allTools.filter((tool) => options.allowedTools?.includes(tool.name))
      : allTools,
    memory: options.memory,
    observability:
      options.enableTracing && tracing.observer
        ? { observers: { lens: tracing.observer } }
        : undefined,
    maxTurns: 8,
  });
}

export function getSystemAnalystToolNames(options: CreateSystemAnalystAgentOptions = {}) {
  const toolNames = [
    "draft_brd",
    "elicit_clarifications",
    "modify_brd",
    "answer_brd_question",
    "search_context",
    "get_template_structure",
    "get_active_brd",
    "web_search",
  ];
  return options.additionalTools
    ? toolNames.concat(options.additionalTools.map((tool) => tool.name))
    : toolNames;
}

export { BRD_OUTPUT_GUIDANCE, SYSTEM_ANALYST_INSTRUCTIONS } from "./prompt/instructions.js";
