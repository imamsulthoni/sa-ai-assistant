-- Drop the flowchart verification report column; flowchart verification
-- is removed in favor of treating every uploaded file as session context.
ALTER TABLE "Document" DROP COLUMN "report";
