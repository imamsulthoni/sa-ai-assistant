ALTER TABLE "AgentMemorySession" ADD COLUMN "projectId" TEXT;
CREATE INDEX "AgentMemorySession_projectId_idx" ON "AgentMemorySession"("projectId");

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrdDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "contentMarkdown" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrdDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrdVersion" (
    "id" TEXT NOT NULL,
    "brdDocumentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "changeSummary" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'AI_AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrdVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "customBaseUrl" TEXT,
    "encryptedApiKey" TEXT,
    "systemPrompt" TEXT,
    "activeTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrdVersion_brdDocumentId_versionNumber_key" ON "BrdVersion"("brdDocumentId", "versionNumber");
CREATE INDEX "BrdDocument_userId_sessionId_idx" ON "BrdDocument"("userId", "sessionId");
CREATE INDEX "BrdDocument_userId_title_idx" ON "BrdDocument"("userId", "title");
CREATE INDEX "BrdVersion_brdDocumentId_idx" ON "BrdVersion"("brdDocumentId");
CREATE UNIQUE INDEX "UserSetting_userId_key" ON "UserSetting"("userId");

ALTER TABLE "AgentMemorySession" ADD CONSTRAINT "AgentMemorySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrdVersion" ADD CONSTRAINT "BrdVersion_brdDocumentId_fkey" FOREIGN KEY ("brdDocumentId") REFERENCES "BrdDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
