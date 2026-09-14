/** Prisma error code for "record required for update/delete was not found". */
export function isRecordNotFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2025";
}
