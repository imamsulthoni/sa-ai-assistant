-- Session 2 ingestion metadata and template confirmation lifecycle.
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';

ALTER TABLE "Document"
  ADD COLUMN "templateStructure" JSONB,
  ADD COLUMN "report" JSONB;
