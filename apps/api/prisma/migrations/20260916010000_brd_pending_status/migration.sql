-- Remember the status before a staged modification so rejecting it can restore it.
ALTER TABLE "BrdDocument" ADD COLUMN "statusBeforePending" "BrdDocumentStatus";