import { prisma } from "../../lib/prisma.js";

export type SearchType = "brd" | "document";

export async function searchUserContent(
  userId: string,
  query: string,
  type: SearchType | undefined,
  excludeSession: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const contains = { contains: query, mode: "insensitive" as const };
  const results: Array<Record<string, unknown>> = [];
  if (!type || type === "brd") {
    const brds = await prisma.brdDocument.findMany({
      where: {
        userId,
        title: contains,
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
        sessionId: document.sessionId,
        status: document.status,
        updatedAt: document.updatedAt,
      })),
    );
  }
  return results;
}
