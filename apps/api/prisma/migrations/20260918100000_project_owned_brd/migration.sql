-- Project ownership + project-scoped BRD & document knowledge base.
--
-- Existing dev data is intentionally discarded (testing will start from a
-- clean slate), so there is no backfill: BRD/flow rows are dropped and
-- project references on sessions/documents are detached before Project gains
-- a required owner.

DELETE FROM "BrdFlowState";
DELETE FROM "BrdDocument";
UPDATE "AgentMemorySession" SET "projectId" = NULL;
UPDATE "Document" SET "projectId" = NULL;
DELETE FROM "Project";

-- Project: owner + default (Inbox) flag
ALTER TABLE "Project" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "Project" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_userId_isDefault_idx" ON "Project"("userId", "isDefault");

-- Sessions belong to a project for their whole life
CREATE INDEX "AgentMemorySession_projectId_idx" ON "AgentMemorySession"("projectId");
ALTER TABLE "AgentMemorySession" DROP CONSTRAINT "AgentMemorySession_projectId_fkey";
ALTER TABLE "AgentMemorySession" ADD CONSTRAINT "AgentMemorySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Documents are project knowledge base entries (sessionId is just the origin)
ALTER TABLE "Document" DROP CONSTRAINT "Document_projectId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BRD: one per project, sessionId becomes the origin marker
ALTER TABLE "BrdDocument" ADD COLUMN "projectId" TEXT NOT NULL;
DROP INDEX "BrdDocument_userId_sessionId_idx";
ALTER TABLE "BrdDocument" ALTER COLUMN "sessionId" DROP NOT NULL;
CREATE UNIQUE INDEX "BrdDocument_projectId_key" ON "BrdDocument"("projectId");
ALTER TABLE "BrdDocument" ADD CONSTRAINT "BrdDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BRD flow/lock is project-level so every session shares the same checkpoint
ALTER TABLE "BrdFlowState" ADD COLUMN "projectId" TEXT NOT NULL;
DROP INDEX "BrdFlowState_userId_sessionId_key";
ALTER TABLE "BrdFlowState" ALTER COLUMN "sessionId" DROP NOT NULL;
CREATE UNIQUE INDEX "BrdFlowState_projectId_key" ON "BrdFlowState"("projectId");
ALTER TABLE "BrdFlowState" ADD CONSTRAINT "BrdFlowState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
