import { Agent, AnyTool, type AgentOptions } from "@anvia/core";
import {
  BRD_OUTPUT_GUIDANCE,
  SYSTEM_ANALYST_INSTRUCTIONS,
} from "./prompt/instructions.js";
import { createOpenAIModel } from "./provider/openai.js";
import { createExaProvider, type ExaProvider } from "./provider/exa.js";
import {
  answerBrdQuestionTool,
  createContextSearchTool,
  createWireframeSpecificationTool,
  draftBrdTool,
  modifyBrdTool,
  verifyFlowchartTool,
} from "./tools/index.js";
import { createTracing } from "./tracing.js";

export interface CreateSystemAnalystAgentOptions {
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  exa?: ExaProvider;
  memory?: AgentOptions["memory"];
  additionalTools?: AnyTool[];
  enableTracing?: boolean;
}

export function createSystemAnalystAgent(
  options: CreateSystemAnalystAgentOptions = {},
) {
  const tracing = createTracing();
  const exa = options.exa ?? createExaProvider();
  return new Agent({
    id: "system-analyst-assistant",
    name: "System Analyst AI Assistant",
    description: "Drafts and reviews BRDs and wireframe-ready specifications.",
    model: createOpenAIModel({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      modelId: options.modelId,
    }),
    instructions: `${SYSTEM_ANALYST_INSTRUCTIONS}\n\n${BRD_OUTPUT_GUIDANCE}`,
    tools: [
      createContextSearchTool(exa),
      draftBrdTool,
      modifyBrdTool,
      answerBrdQuestionTool,
      verifyFlowchartTool,
      createWireframeSpecificationTool,
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
