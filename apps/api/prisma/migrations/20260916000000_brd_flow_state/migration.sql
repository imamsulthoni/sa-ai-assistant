-- BRD flow checkpoint per session (clarify/generate resume) plus pending import pointer.
CREATE TYPE "BrdFlowPhase" AS ENUM ('CLARIFYING', 'GENERATING');

CREATE TABLE "BrdFlowState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" "BrdFlowPhase",
    "userStory" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "questions" JSONB,
    "answers" JSONB,
    "pendingImportDocumentId" TEXT,
    "generatingSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrdFlowState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrdFlowState_userId_sessionId_key" ON "BrdFlowState"("userId", "sessionId");
