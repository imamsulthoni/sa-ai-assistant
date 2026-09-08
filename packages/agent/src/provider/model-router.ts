import type { OpenAICompletionModel } from "@anvia/openai";
import { createOpenAIModel } from "./openai.js";

export type TaskDifficulty = "easy" | "medium" | "hard";

export interface ModelRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModelId?: string;
  easyModelId?: string;
  mediumModelId?: string;
  hardModelId?: string;
}

export interface ModelRouter {
  getModel(difficulty?: TaskDifficulty): OpenAICompletionModel;
  getModelId(difficulty?: TaskDifficulty): string;
}

function modelIdFor(
  difficulty: TaskDifficulty,
  options: Required<Pick<ModelRouterOptions, "defaultModelId">> & ModelRouterOptions,
): string {
  const modelByDifficulty: Partial<Record<TaskDifficulty, string>> = {
    easy: options.easyModelId,
    medium: options.mediumModelId,
    hard: options.hardModelId,
  };
  return modelByDifficulty[difficulty] ?? options.defaultModelId;
}
export function createModelRouter(options: ModelRouterOptions = {}): ModelRouter {
  const defaultModelId =
    options.defaultModelId ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const resolvedOptions = {
    ...options,
    defaultModelId,
    easyModelId: options.easyModelId ?? process.env.OPENAI_EASY_MODEL,
    mediumModelId: options.mediumModelId ?? process.env.OPENAI_MEDIUM_MODEL,
    hardModelId: options.hardModelId ?? process.env.OPENAI_HARD_MODEL,
  };
  const models = new Map<string, OpenAICompletionModel>();

  return {
    getModelId(difficulty = "medium") {
      return modelIdFor(difficulty, resolvedOptions);
    },
    getModel(difficulty = "medium") {
      const modelId = modelIdFor(difficulty, resolvedOptions);
      const cached = models.get(modelId);
      if (cached) return cached;

      const model = createOpenAIModel({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        modelId,
      });
      models.set(modelId, model);
      return model;
    },
  };
}
