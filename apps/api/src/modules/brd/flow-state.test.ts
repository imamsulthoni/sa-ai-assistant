import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  brdFlowState: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import {
  GENERATION_LOCK_TTL_MS,
  claimGeneration,
  claimPendingImport,
  getBrdFlow,
  markClarifyStarted,
  saveClarifyCheckpoint,
} from "./flow-state.js";

const context = { userId: "user-1", projectId: "project-1", sessionId: "session-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBrdFlow", () => {
  it("returns null when the session has no checkpoint", async () => {
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce(null);
    await expect(getBrdFlow(context)).resolves.toBeNull();
  });

  it("normalizes json columns into safe shapes", async () => {
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce({
      phase: "CLARIFYING",
      userStory: "cerita",
      round: 2,
      questions: null,
      answers: "bukan-objek",
      pendingImportDocumentId: "doc-1",
    });

    await expect(getBrdFlow(context)).resolves.toEqual({
      phase: "CLARIFYING",
      userStory: "cerita",
      round: 2,
      questions: [],
      answers: {},
      pendingImportDocumentId: "doc-1",
    });
  });
});

describe("saveClarifyCheckpoint", () => {
  it("clears the lock when no fresh generation is running", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 1 });

    await saveClarifyCheckpoint(context, {
      userStory: "cerita",
      round: 2,
      questions: [{ id: "q2_1" }],
      answers: { q1_1: "x" },
    });

    expect(prismaMock.brdFlowState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          NOT: {
            phase: "GENERATING",
            generatingSince: { gt: expect.any(Date) },
          },
        }),
        data: expect.objectContaining({ phase: "CLARIFYING", generatingSince: null }),
      }),
    );
  });

  it("does not cancel a fresh generation lock from another tab", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce({ id: "flow-1" });

    await saveClarifyCheckpoint(context, {
      userStory: "cerita",
      round: 2,
      questions: [],
      answers: {},
    });

    expect(prismaMock.brdFlowState.create).not.toHaveBeenCalled();
  });

  it("creates the checkpoint when the session has no flow row yet", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce(null);

    await saveClarifyCheckpoint(context, {
      userStory: "cerita",
      round: 1,
      questions: [{ id: "q1_1" }],
      answers: {},
    });

    expect(prismaMock.brdFlowState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        sessionId: "session-1",
        phase: "CLARIFYING",
      }),
    });
  });
});

describe("markClarifyStarted", () => {
  it("records the in-flight clarify without dropping previous questions", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 1 });

    await markClarifyStarted(context, {
      userStory: "cerita",
      round: 1,
      answers: { q1_1: "x" },
    });

    expect(prismaMock.brdFlowState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "project-1" }),
        data: expect.objectContaining({
          phase: "CLARIFYING",
          userStory: "cerita",
          round: 1,
          generatingSince: null,
        }),
      }),
    );
    expect(prismaMock.brdFlowState.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      "questions",
    );
  });

  it("creates a checkpoint row when the flow is new", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce(null);

    await markClarifyStarted(context, { userStory: "cerita", round: 1, answers: {} });

    expect(prismaMock.brdFlowState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        sessionId: "session-1",
        phase: "CLARIFYING",
        userStory: "cerita",
      }),
    });
  });

  it("leaves a fresh generation lock untouched", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.brdFlowState.findUnique.mockResolvedValueOnce({ id: "flow-1" });

    await markClarifyStarted(context, { userStory: "cerita", round: 1, answers: {} });

    expect(prismaMock.brdFlowState.create).not.toHaveBeenCalled();
  });
});

describe("claimGeneration", () => {
  it("claims when the lock is empty or stale", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(claimGeneration(context)).resolves.toBe(true);

    const call = prismaMock.brdFlowState.updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ phase: "GENERATING", generatingSince: expect.any(Date) });
    expect(call.where.OR).toEqual([
      { generatingSince: null },
      { generatingSince: { lt: expect.any(Date) } },
    ]);
    const staleThreshold = call.where.OR[1].generatingSince.lt as Date;
    expect(Date.now() - staleThreshold.getTime()).toBeGreaterThanOrEqual(
      GENERATION_LOCK_TTL_MS - 1000,
    );
  });

  it("refuses to claim when another generation is still fresh", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(claimGeneration(context)).resolves.toBe(false);
  });
});

describe("claimPendingImport", () => {
  it("only claims the exact pending document", async () => {
    prismaMock.brdFlowState.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(claimPendingImport(context, "doc-1")).resolves.toBe(true);
    expect(prismaMock.brdFlowState.updateMany).toHaveBeenCalledWith({
      where: { projectId: "project-1", pendingImportDocumentId: "doc-1" },
      data: { pendingImportDocumentId: null },
    });
  });
});
