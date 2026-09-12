import { z } from "zod";
import { generateCompletion } from "@anvia/core";
import type { CompletionRequest, Message } from "@anvia/core";
import type { StreamingCompletionModel } from "@anvia/core/completion";
import type { OpenAICompletionModel } from "@anvia/openai";
import { createOpenAIModel } from "./openai.js";

export type TaskDifficulty = "easy" | "medium" | "hard";
export type AgentPhase = "CLARIFY" | "GENERATE" | "QA";

export interface ModelRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModelId?: string;
  easyModelId?: string;
  mediumModelId?: string;
  hardModelId?: string;
  routerModelId?: string;
}

export interface ModelRouter {
  getModel(difficulty?: TaskDifficulty): OpenAICompletionModel;
  getModelId(difficulty?: TaskDifficulty): string;
  getModelForTask(task: string): Promise<OpenAICompletionModel>;
  getModelForPhase(phase: AgentPhase): OpenAICompletionModel;
}

const DifficultyDecisionSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
  reason: z.string(),
});

const DIFFICULTY_GUIDANCE = `
Decide how difficult the task is before routing it to the right model.

- easy: short factual answers, quick clarification, simple extraction, low reasoning.
- medium: drafting or modifying a BRD section, answering questions about an existing BRD, moderate reasoning.
- hard: creating a full BRD from scratch, complex multi-step analysis, verifying flowcharts, deep reasoning.

Return the difficulty and a one-sentence reason.
`;

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function modelIdFor(
  difficulty: TaskDifficulty,
  options: Required<Pick<ModelRouterOptions, "defaultModelId">> & ModelRouterOptions,
): string {
  const modelByDifficulty: Partial<Record<TaskDifficulty, string | undefined>> = {
    easy: options.easyModelId,
    medium: options.mediumModelId,
    hard: options.hardModelId,
  };
  return firstNonEmpty(modelByDifficulty[difficulty], options.defaultModelId)!;
}

export function createModelRouter(options: ModelRouterOptions = {}): ModelRouter {
  const defaultModelId =
    firstNonEmpty(options.defaultModelId, process.env.OPENAI_MODEL) ?? "gpt-4o-mini";
  const resolvedOptions = {
    ...options,
    defaultModelId,
    easyModelId: firstNonEmpty(options.easyModelId, process.env.OPENAI_EASY_MODEL),
    mediumModelId: firstNonEmpty(options.mediumModelId, process.env.OPENAI_MEDIUM_MODEL),
    hardModelId: firstNonEmpty(options.hardModelId, process.env.OPENAI_HARD_MODEL),
    routerModelId: firstNonEmpty(options.routerModelId, process.env.OPENAI_ROUTER_MODEL),
  };
  const models = new Map<string, OpenAICompletionModel>();

  const createModel = (modelId: string): OpenAICompletionModel => {
    const cached = models.get(modelId);
    if (cached) return cached;
    const model = createOpenAIModel({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      modelId,
    });
    models.set(modelId, model);
    return model;
  };

  return {
    getModelId(difficulty = "medium") {
      return modelIdFor(difficulty, resolvedOptions);
    },
    getModel(difficulty = "medium") {
      return createModel(modelIdFor(difficulty, resolvedOptions));
    },
    async getModelForTask(task) {
      const routerModelId =
        resolvedOptions.routerModelId ??
        resolvedOptions.easyModelId ??
        resolvedOptions.defaultModelId;
      const routerModel = createModel(routerModelId);

      const decision = await generateCompletion({
        model: routerModel,
        prompt: task,
        instructions: DIFFICULTY_GUIDANCE,
        outputSchema: DifficultyDecisionSchema,
      });

      return createModel(modelIdFor(decision.output.difficulty, resolvedOptions));
    },
    getModelForPhase(phase) {
      const difficulty = phase === "CLARIFY" ? "easy" : phase === "GENERATE" ? "hard" : "medium";
      return createModel(modelIdFor(difficulty, resolvedOptions));
    },
  };
}

export type RoutingCompletionModel = StreamingCompletionModel<unknown>;

const HARD_PATTERNS = [
  /\bfrom scratch\b/,
  /\b(full|complete|entire|whole) brd\b/,
  /\b(create|draft|write|build|generate) (a |the |an )?brd\b/,
  /\bverify( the)? flowchart\b/,
  /\b(complex|multi-?step|deep|comprehensive|thorough|extensive)\b/,
];

const MEDIUM_PATTERNS = [
  /\b(modify|update|edit|revise|change|adjust|improve)\b/,
  /\b(brd )?section\b/,
  /\b(answer|explain|summarize|summarise|review|describe|clarify)\b/,
  /\b(draft|write|create|add) (a |the )?(brd )?(section|part|chapter)\b/,
];

const EASY_PATTERNS = [
  /\b(hi|hello|hey|halo)\b/,
  /\b(who are you|what are you|what model|which model|what tools|what agent)\b/,
];

export function heuristicDifficulty(task: string): TaskDifficulty | undefined {
  const t = task.trim().toLowerCase();
  if (!t) return undefined;

  if (HARD_PATTERNS.some((re) => re.test(t))) return "hard";
  if (MEDIUM_PATTERNS.some((re) => re.test(t))) return "medium";
  if (EASY_PATTERNS.some((re) => re.test(t))) return "easy";

  if (t.length <= 60 && !/brd|flowchart|draft|create|modify|verify/.test(t)) {
    return "easy";
  }

  return undefined;
}

function firstUserText(messages: readonly Message[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const content = message.content;

    if (typeof content === "string") return content.trim();
    const text = content
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");

    if (text.trim()) return text.trim();
  }
  return "";
}

function latestUserText(messages: readonly Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role !== "user") continue;
    const content = message.content;

    if (typeof content === "string") return content;
    const text = content
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");

    if (text.trim()) return text;
  }
  return "";
}

const SESSION_CACHE_LIMIT = 100;

export function createRoutingModel(
  router: ModelRouter,
  routingOptions: { debug?: boolean } = {},
): RoutingCompletionModel {
  const fallback = router.getModel();
  const sessionCache = new Map<string, OpenAICompletionModel>();

  const routeModel = async (request: CompletionRequest): Promise<OpenAICompletionModel> => {
    const sessionKey = firstUserText(request.chatHistory);
    if (sessionKey) {
      const cached = sessionCache.get(sessionKey);
      if (cached) {
        if (routingOptions.debug) {
          console.log(`[model-router] cached -> ${cached.modelId}`);
        }
        return cached;
      }
    }

    const task = latestUserText(request.chatHistory);
    let model: OpenAICompletionModel;
    let source: "heuristic" | "llm";

    const heuristic = heuristicDifficulty(task);
    if (heuristic) {
      model = router.getModel(heuristic);
      source = "heuristic";
    } else {
      model = await router.getModelForTask(task);
      source = "llm";
    }

    if (sessionKey) {
      if (sessionCache.size >= SESSION_CACHE_LIMIT) {
        const oldest = sessionCache.keys().next().value;
        if (oldest !== undefined) sessionCache.delete(oldest);
      }
      sessionCache.set(sessionKey, model);
    }

    if (routingOptions.debug) {
      console.log(`[model-router] ${source} -> ${model.modelId}`);
    }
    return model;
  };

  return {
    provider: fallback.provider,
    modelId: fallback.modelId,
    contextLimits: fallback.contextLimits,
    capabilities: fallback.capabilities,
    controls: fallback.controls,
    async completion(request, options) {
      const model = await routeModel(request);
      return model.completion(request, options);
    },
    async *streamCompletion(request, options) {
      const model = await routeModel(request);
      yield* model.streamCompletion(request, options);
    },
  };
}
