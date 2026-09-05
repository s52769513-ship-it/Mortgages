-- When a file entered the stage it is standing in. A count of files per stage
-- says where the work is; this says where it stopped moving.
ALTER TABLE "MortgageFile" ADD COLUMN "stageEnteredAt" TIMESTAMP(3);

-- Backfill from the audit trail, which has recorded every stage change since
-- the system opened. A file that never moved takes the date it was opened.
UPDATE "MortgageFile" f
SET "stageEnteredAt" = COALESCE(
  (
    SELECT MAX(a."createdAt")
    FROM "ActivityLog" a
    WHERE a."entityType" = 'MORTGAGE_FILE'
      AND a."entityId" = f."id"
      AND a."action" = 'שינוי שלב'
  ),
  f."createdAt"
);
