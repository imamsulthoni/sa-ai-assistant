import type { CompletionRequest, Message } from "@anvia/core";
import type { OpenAICompletionModel } from "@anvia/openai";
import { describe, expect, it } from "vitest";
import { createQaRoutingModel, qaDifficultyFor, type ModelRouter } from "./model-router.js";

function userMessage(content: string): Message {
  return { role: "user", content };
}

function request(content: string): CompletionRequest {
  return { chatHistory: [userMessage(content)], documents: [], tools: [] };
}

function fakeModel(modelId: string, calls: string[]): OpenAICompletionModel {
  return {
    provider: "test",
    modelId,
    capabilities: {
      streaming: true,
      tools: false,
      toolChoice: false,
      imageInput: false,
      documentInput: false,
      outputSchema: false,
      reasoning: false,
    },
    async completion() {
      calls.push(modelId);
      return {} as never;
    },
    async *streamCompletion() {
      calls.push(modelId);
    },
  } as unknown as OpenAICompletionModel;
}

function fakeRouter(router: { easy: OpenAICompletionModel; medium: OpenAICompletionModel }): ModelRouter {
  return {
    getModel: (difficulty = "medium") => (difficulty === "easy" ? router.easy : router.medium),
    getModelId: (difficulty = "medium") =>
      difficulty === "easy" ? router.easy.modelId : router.medium.modelId,
    getModelForTask: async () => router.medium,
    getModelForPhase: () => router.medium,
  };
}

describe("qaDifficultyFor", () => {
  it("defaults to easy for factual questions", () => {
    expect(qaDifficultyFor("Apa isi BR-001?")).toBe("easy");
    expect(qaDifficultyFor("What does FR-002 cover?")).toBe("easy");
    expect(qaDifficultyFor("")).toBe("easy");
  });

  it("routes modification or enrichment requests to medium", () => {
    expect(qaDifficultyFor("Tolong perbarui bagian validasi pengajuan")).toBe("medium");
    expect(qaDifficultyFor("Please enrich section 5 with edge cases")).toBe("medium");
    expect(qaDifficultyFor("Tambahkan acceptance criteria untuk alur gagal")).toBe("medium");
  });
});

describe("createQaRoutingModel", () => {
  it("picks the easy model for factual QA", async () => {
    const calls: string[] = [];
    const model = createQaRoutingModel(
      fakeRouter({ easy: fakeModel("easy-model", calls), medium: fakeModel("medium-model", calls) }),
    );

    for await (const _event of model.streamCompletion(request("Apa isi BR-001?"))) {
      void _event;
    }

    expect(calls).toEqual(["easy-model"]);
  });

  it("picks the medium model when the user asks for a modification", async () => {
    const calls: string[] = [];
    const model = createQaRoutingModel(
      fakeRouter({ easy: fakeModel("easy-model", calls), medium: fakeModel("medium-model", calls) }),
    );

    for await (const _event of model.streamCompletion(request("Tolong hapus requirement FR-003"))) {
      void _event;
    }

    expect(calls).toEqual(["medium-model"]);
  });
});
