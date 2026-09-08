import { Agent, AnyTool, type MemoryStore } from "@anvia/core";
import {
  createModelRouter,
  type TaskDifficulty,
} from "./provider/model-router.js";
import {
  createTavilyProvider,
  type TavilyProvider,
} from "./provider/tavily.js";
import type { LangfuseTracing } from "./tracing.js";
import {
  BRD_OUTPUT_GUIDANCE,
  SYSTEM_ANALYST_INSTRUCTIONS,
} from "./prompt/instructions.js";
import {
  answerBrdQuestionTool,
  webTools,
  draftBrdTool,
  elicitBrdClarificationsTool,
  modifyBrdTool,
  verifyFlowchartTool,
} from "./tools/index.js";

export interface CreateSystemAnalystAgentOptions {
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  tavily?: TavilyProvider;
  difficulty?: TaskDifficulty;
  tracing?: LangfuseTracing;
  memory?: MemoryStore;
  additionalTools?: AnyTool[];
}

export function createSystemAnalystAgent(
  options: CreateSystemAnalystAgentOptions = {},
) {
  const tavily = options.tavily ?? createTavilyProvider();
  const modelRouter = createModelRouter({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    defaultModelId: options.modelId,
  });

  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts, verifies, and refines grounded BRD requirements.",
    model: modelRouter.getModel(options.difficulty ?? "medium"),
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}`,
    tools: [
      ...webTools(tavily),
      elicitBrdClarificationsTool,
      draftBrdTool,
      modifyBrdTool,
      answerBrdQuestionTool,
      verifyFlowchartTool,
      ...(options.additionalTools ?? []),
    ],
    ...(options.tracing?.observer
      ? { observability: { observers: { langfuse: options.tracing.observer } } }
      : {}),
    ...(options.memory ? { memory: { store: options.memory } } : {}),
  });
}

export {
  BRD_OUTPUT_GUIDANCE,
  SYSTEM_ANALYST_INSTRUCTIONS,
} from "./prompt/instructions.js";
