-- Running number per file for tasks, documents and bank applications.
-- The column is added first, existing rows are numbered by creation order,
-- and only then is the uniqueness enforced — otherwise every file holding
-- more than one row would collide on the default of 0.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BankApplication" ADD COLUMN "seq" INTEGER NOT NULL DEFAULT 0;

-- Backfill
UPDATE "Task" t
SET "seq" = numbered.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "fileId" ORDER BY "createdAt", "id") AS rn
  FROM "Task"
) AS numbered
WHERE t."id" = numbered."id";

UPDATE "Document" d
SET "seq" = numbered.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "fileId" ORDER BY "createdAt", "id") AS rn
  FROM "Document"
) AS numbered
WHERE d."id" = numbered."id";

UPDATE "BankApplication" b
SET "seq" = numbered.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "fileId" ORDER BY "createdAt", "id") AS rn
  FROM "BankApplication"
) AS numbered
WHERE b."id" = numbered."id";

-- CreateIndex
CREATE UNIQUE INDEX "Task_fileId_seq_key" ON "Task"("fileId", "seq");
CREATE UNIQUE INDEX "Document_fileId_seq_key" ON "Document"("fileId", "seq");
CREATE UNIQUE INDEX "BankApplication_fileId_seq_key" ON "BankApplication"("fileId", "seq");
