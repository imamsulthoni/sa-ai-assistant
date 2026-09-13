import { Agent, AnyTool, type AgentOptions } from "@anvia/core";
import { BRD_OUTPUT_GUIDANCE, SYSTEM_ANALYST_INSTRUCTIONS } from "./prompt/instructions.js";
import { CLARIFY_INSTRUCTIONS, GENERATE_INSTRUCTIONS, JUDGE_INSTRUCTIONS, QA_INSTRUCTIONS } from "./prompt/index.js";
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
  phase?: "CLARIFY" | "JUDGE" | "GENERATE" | "QA";
  contextAdapters?: AgentContextAdapters;
  systemPrompt?: string;
  templateInstruction?: string;
  allowedTools?: string[];
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
      : createRoutingModel(router, { debug: options.debugModelRouter })
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
    verifyFlowchartTool,
    ...(options.contextAdapters
      ? [createSearchContextTool(options.contextAdapters), createTemplateStructureTool(options.contextAdapters), createActiveBrdTool(options.contextAdapters)]
      : [searchContextTool, getTemplateStructureTool, getActiveBrdTool]),
    ...webTools(tavily),
    ...(options.additionalTools ?? []),
  ];
  const phaseInstructions = options.phase === "CLARIFY" ? CLARIFY_INSTRUCTIONS : options.phase === "JUDGE" ? JUDGE_INSTRUCTIONS : options.phase === "GENERATE" ? GENERATE_INSTRUCTIONS : options.phase === "QA" ? QA_INSTRUCTIONS : "";
  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts and reviews BRDs and grounded specifications.",
    model,
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}\n\n${phaseInstructions}${options.templateInstruction ? `\n\n${options.templateInstruction}` : ""}${options.systemPrompt ? `\n\nAdditional user instructions:\n${options.systemPrompt}` : ""}`,
    tools: options.allowedTools ? allTools.filter((tool) => options.allowedTools?.includes(tool.name)) : allTools,
    memory: options.memory,
    observability: options.enableTracing && tracing.observer ? { observers: { lens: tracing.observer } } : undefined,
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

