import { Agent, AnyTool, type AgentOptions } from "@anvia/core";
import { BRD_OUTPUT_GUIDANCE, SYSTEM_ANALYST_INSTRUCTIONS } from "./prompt/instructions.js";
import { createOpenAIModel } from "./provider/openai.js";
import {
  createModelRouter,
  createRoutingModel,
  type ModelRouterOptions,
} from "./provider/model-router.js";
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
  verifyFlowchartTool,
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
  debugModelRouter?: boolean;
  phase?: "CLARIFY" | "GENERATE" | "QA";
  contextAdapters?: AgentContextAdapters;
  systemPrompt?: string;
  /** Rendered active BRD template guidance; output MUST follow it when present. */
  templateInstruction?: string;
}

export function createSystemAnalystAgent(options: CreateSystemAnalystAgentOptions = {}) {
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
      : createRoutingModel(router, { debug: options.debugModelRouter })
    : createOpenAIModel({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        modelId: options.modelId,
      });

  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts and reviews BRDs and grounded specifications.",
    model,
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}${options.templateInstruction ? `\n\n${options.templateInstruction}` : ""}${options.systemPrompt ? `\n\nAdditional user instructions:\n${options.systemPrompt}` : ""}`,
    tools: [
      draftBrdTool,
      elicitClarificationsTool,
      modifyBrdTool,
      answerBrdQuestionTool,
      verifyFlowchartTool,
      ...(options.contextAdapters
        ? [
            createSearchContextTool(options.contextAdapters),
            createTemplateStructureTool(options.contextAdapters),
            createActiveBrdTool(options.contextAdapters),
          ]
        : [searchContextTool, getTemplateStructureTool, getActiveBrdTool]),
      ...webTools(tavily),
      ...(options.additionalTools ?? []),
    ],
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
    "verify_flowchart",
    "search_context",
    "get_template_structure",
    "get_active_brd",
    "web_search",
  ];
  return options.additionalTools ? toolNames.concat(options.additionalTools.map((tool) => tool.name)) : toolNames;
}

export { BRD_OUTPUT_GUIDANCE, SYSTEM_ANALYST_INSTRUCTIONS } from "./prompt/instructions.js";

