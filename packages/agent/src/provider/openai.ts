import { OpenAIClient, type OpenAICompletionModel } from "@anvia/openai";

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

export function createOpenAIModel(
  options: OpenAIProviderOptions = {},
): OpenAICompletionModel {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to create the OpenAI model");
  }

  const client = new OpenAIClient({
    apiKey,
    ...(options.baseUrl ?? process.env.OPENAI_BASE_URL
      ? { baseUrl: options.baseUrl ?? process.env.OPENAI_BASE_URL }
      : {}),
  });
  return client.completionModel({
    modelId: options.modelId ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  });
}
