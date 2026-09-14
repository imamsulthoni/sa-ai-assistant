-- BRD review lifecycle: Draft -> In Review -> Approved, with approval audit.
CREATE TYPE "BrdDocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');

ALTER TABLE "BrdDocument" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BrdDocument"
  ALTER COLUMN "status" TYPE "BrdDocumentStatus"
  USING ("status"::text::"BrdDocumentStatus");
ALTER TABLE "BrdDocument" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "BrdDocument" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "BrdDocument" ADD COLUMN "approvedBy" TEXT;