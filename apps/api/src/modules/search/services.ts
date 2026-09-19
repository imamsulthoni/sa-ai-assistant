import { prisma } from "../../lib/prisma.js";

export type SearchType = "brd" | "document";

export type SearchFilters = {
  projectId?: string | undefined;
  sessionId?: string | undefined;
  excludeSession?: string | undefined;
};

export async function searchUserContent(
  userId: string,
  query: string,
  type: SearchType | undefined,
  filters: SearchFilters = {},
): Promise<Array<Record<string, unknown>>> {
  const { projectId, sessionId, excludeSession } = filters;
  const contains = { contains: query, mode: "insensitive" as const };
  const results: Array<Record<string, unknown>> = [];
  if (!type || type === "brd") {
    const brds = await prisma.brdDocument.findMany({
      where: {
        userId,
        title: contains,
        ...(projectId ? { projectId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(excludeSession ? { NOT: { sessionId: excludeSession } } : {}),
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    results.push(
      ...brds.map((brd) => ({
        type: "brd",
        id: brd.id,
        title: brd.title,
        projectId: brd.projectId,
        sessionId: brd.sessionId,
        updatedAt: brd.updatedAt,
      })),
    );
  }
  if (!type || type === "document") {
    const documents = await prisma.document.findMany({
      where: {
        userId,
        title: contains,
        ...(projectId ? { projectId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(excludeSession ? { NOT: { sessionId: excludeSession } } : {}),
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    results.push(
      ...documents.map((document) => ({
        type: "document",
        id: document.id,
        title: document.title,
        projectId: document.projectId,
        sessionId: document.sessionId,
        status: document.status,
        updatedAt: document.updatedAt,
      })),
    );
  }
  return results;
}