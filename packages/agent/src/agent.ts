import { Agent, AnyTool, type AgentOptions } from "@anvia/core";
import {
  BRD_OUTPUT_GUIDANCE,
  SYSTEM_ANALYST_INSTRUCTIONS,
} from "./prompt/instructions.js";
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
}

export function createSystemAnalystAgent(
  options: CreateSystemAnalystAgentOptions = {},
) {
  const tracing = createTracing();
  const tavily = createTavilyProvider();
  const model = options.modelRouter
    ? createRoutingModel(
        createModelRouter({
          ...options.modelRouter,
          apiKey: options.modelRouter.apiKey ?? options.apiKey,
          baseUrl: options.modelRouter.baseUrl ?? options.baseUrl,
        }),
        { debug: options.debugModelRouter },
      )
    : createOpenAIModel({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        modelId: options.modelId,
      });

  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts and reviews BRDs and wireframe-ready specifications.",
    model,
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}`,
    tools: [
      draftBrdTool,
      modifyBrdTool,
      answerBrdQuestionTool,
      verifyFlowchartTool,
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

export {
  BRD_OUTPUT_GUIDANCE,
  SYSTEM_ANALYST_INSTRUCTIONS,
} from "./prompt/instructions.js";
