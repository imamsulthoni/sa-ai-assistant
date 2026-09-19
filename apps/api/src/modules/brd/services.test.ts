import { beforeEach, describe, expect, it, vi } from "vitest";

// The module under test pulls in the memory store, which validates the client shape.
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  agentMemorySession: { upsert: vi.fn(), deleteMany: vi.fn() },
  agentMemoryMessage: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  brdDocument: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import {
  collectAgent,
  createBrd,
  pickBestMarkdown,
  rejectBrdModification,
  stageBrdModification,
} from "./services.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickBestMarkdown", () => {
  const audit = (markdown: string) => ({
    missing: markdown.includes("## Scope") ? [] : ["scope"],
    weak: [],
  });

  it("prefers a complete BRD over a chatty preamble", () => {
    const preamble = "Saya akan menyusun BRD lengkap untuk Anda. Mohon tunggu.";
    const fullBrd = "# BRD — Cuti\n\n## Scope\n\nIsi lengkap.";

    const picked = pickBestMarkdown([preamble, fullBrd], audit);

    expect(picked?.markdown).toBe(fullBrd);
    expect(picked?.issues.missing).toEqual([]);
  });

  it("falls back to the least-broken candidate when none is BRD-shaped", () => {
    const empty = "Halo, saya siap membantu.";
    const partial = "## Scope\n\nHanya bagian scope.";

    const picked = pickBestMarkdown([empty, partial], audit);

    expect(picked?.markdown).toBe(partial);
  });

  it("prefers a candidate that includes a mermaid flowchart when issues tie", () => {
    const withoutDiagram = "# BRD — Cuti\n\n## Scope\n\nIsi lengkap.";
    const withDiagram = `${withoutDiagram}\n\n\`\`\`mermaid\nflowchart TD\n  A[Mulai] --> B[Selesai]\n\`\`\``;

    const picked = pickBestMarkdown([withoutDiagram, withDiagram], audit);

    expect(picked?.markdown).toBe(withDiagram);
  });

  it("returns null when every candidate is blank", () => {
    expect(pickBestMarkdown(["   ", ""], audit)).toBeNull();
  });
});

describe("createBrd", () => {
  it("returns the existing project BRD instead of creating a second one", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({ id: "brd-1", projectId: "p-1" });

    const result = await createBrd("user-1", {
      projectId: "p-1",
      title: "BRD Cuti",
      contentMarkdown: "# BRD",
    });

    expect(result).toMatchObject({ id: "brd-1" });
    expect(prismaMock.brdDocument.create).not.toHaveBeenCalled();
  });

  it("creates a BRD for a project that has none yet", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce(null);
    prismaMock.brdDocument.create.mockResolvedValueOnce({ id: "brd-new", projectId: "p-1" });

    const result = await createBrd("user-1", {
      projectId: "p-1",
      sessionId: "s-1",
      title: "BRD Cuti",
      contentMarkdown: "# BRD",
    });

    expect(result).toMatchObject({ id: "brd-new" });
    expect(prismaMock.brdDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "p-1", sessionId: "s-1" }),
      }),
    );
  });
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
  const context = { userId: "user-1", projectId: "project-1", sessionId: "session-1" };

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
