import { beforeEach, describe, expect, it, vi } from "vitest";

// The module under test pulls in the memory store, which validates the client shape.
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  agentMemorySession: { upsert: vi.fn(), deleteMany: vi.fn() },
  agentMemoryMessage: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  brdDocument: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { collectAgent, rejectBrdModification, stageBrdModification } from "./services.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stageBrdModification", () => {
  it("puts a draft under review and remembers the previous status", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "DRAFT",
      statusBeforePending: null,
      pendingContentMarkdown: null,
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await expect(
      stageBrdModification("user-1", "brd-1", "konten baru", "ringkasan"),
    ).resolves.toEqual({
      ok: true,
      status: "staged",
    });
    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith({
      where: { id: "brd-1" },
      data: {
        pendingContentMarkdown: "konten baru",
        pendingChangeSummary: "ringkasan",
        statusBeforePending: "DRAFT",
        status: "IN_REVIEW",
      },
    });
  });

  it("keeps the original restore point when an approved document is modified again", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "APPROVED",
      statusBeforePending: "DRAFT",
      pendingContentMarkdown: null,
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await stageBrdModification("user-1", "brd-1", "konten baru", "ringkasan");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusBeforePending: "DRAFT", status: "IN_REVIEW" }),
      }),
    );
  });

  it("never overwrites an unresolved pending preview", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: "DRAFT",
      pendingContentMarkdown: "preview lama",
    });

    const result = await stageBrdModification("user-1", "brd-1", "preview baru", "ringkasan");

    expect(result).toMatchObject({ ok: false, reason: "pending_exists" });
    expect(prismaMock.brdDocument.update).not.toHaveBeenCalled();
  });
});

describe("collectAgent", () => {
  const context = { userId: "user-1", sessionId: "session-1" };

  function fakeAgent(events: unknown[]) {
    return {
      memory: undefined,
      stream: async function* () {
        for (const event of events) yield event;
      },
    } as never;
  }

  it("stops early once the requested tool produced its output", async () => {
    const result = await collectAgent(
      fakeAgent([
        { type: "turn_start" },
        { type: "tool_result", toolName: "search_context" },
        { type: "tool_result", toolName: "elicit_clarifications", output: { value: { ok: true } } },
        { type: "text_delta", delta: "turn echo yang tidak perlu" },
      ]),
      "prompt",
      context,
      { stopOnTool: "elicit_clarifications" },
    );

    expect(result.toolResults.map((event) => event.toolName)).toEqual([
      "search_context",
      "elicit_clarifications",
    ]);
    expect(result.text).toBe("");
  });

  it("keeps streaming when the stop tool returned no usable output", async () => {
    const result = await collectAgent(
      fakeAgent([
        { type: "tool_result", toolName: "elicit_clarifications", output: { value: null } },
        { type: "text_delta", delta: '{"clarification_questions":[]}' },
      ]),
      "prompt",
      context,
      { stopOnTool: "elicit_clarifications" },
    );

    expect(result.text).toBe('{"clarification_questions":[]}');
    expect(result.toolResults).toHaveLength(1);
  });

  it("reads the full stream when no stop tool is configured", async () => {
    const result = await collectAgent(
      fakeAgent([
        { type: "tool_result", toolName: "search_context" },
        { type: "text_delta", delta: "jawaban final" },
      ]),
      "prompt",
      context,
    );

    expect(result.text).toBe("jawaban final");
    expect(result.toolResults).toHaveLength(1);
  });
});

describe("rejectBrdModification", () => {
  it("restores the status the document had before the preview", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: "APPROVED",
      pendingContentMarkdown: "preview",
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await rejectBrdModification("user-1", "brd-1");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith({
      where: { id: "brd-1" },
      data: {
        pendingContentMarkdown: null,
        pendingChangeSummary: null,
        status: "APPROVED",
        statusBeforePending: null,
      },
    });
  });

  it("keeps the current status when there is no restore point", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: null,
      pendingContentMarkdown: "preview",
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await rejectBrdModification("user-1", "brd-1");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_REVIEW", statusBeforePending: null }),
      }),
    );
  });
});
