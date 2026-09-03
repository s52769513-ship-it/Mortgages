-- AlterEnum
BEGIN;
CREATE TYPE "CommunicationType_new" AS ENUM ('EMAIL', 'PHONE', 'MEETING', 'LETTER');
ALTER TABLE "Communication" ALTER COLUMN "type" TYPE "CommunicationType_new" USING ("type"::text::"CommunicationType_new");
ALTER TYPE "CommunicationType" RENAME TO "CommunicationType_old";
ALTER TYPE "CommunicationType_new" RENAME TO "CommunicationType";
DROP TYPE "public"."CommunicationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ContactMethod_new" AS ENUM ('PHONE', 'EMAIL', 'MEETING');
ALTER TABLE "public"."Client" ALTER COLUMN "preferredContact" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "preferredContact" TYPE "ContactMethod_new" USING ("preferredContact"::text::"ContactMethod_new");
ALTER TYPE "ContactMethod" RENAME TO "ContactMethod_old";
ALTER TYPE "ContactMethod_new" RENAME TO "ContactMethod";
DROP TYPE "public"."ContactMethod_old";
ALTER TABLE "Client" ALTER COLUMN "preferredContact" SET DEFAULT 'PHONE';
COMMIT;

-- AlterTable
ALTER TABLE "Communication" DROP COLUMN "counterparty",
ADD COLUMN     "recipient" TEXT,
ADD COLUMN     "sender" TEXT;

-- CreateTable
CREATE TABLE "_CommunicationAttachments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CommunicationAttachments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CommunicationAttachments_B_index" ON "_CommunicationAttachments"("B");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_followUpTaskId_fkey" FOREIGN KEY ("followUpTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommunicationAttachments" ADD CONSTRAINT "_CommunicationAttachments_A_fkey" FOREIGN KEY ("A") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommunicationAttachments" ADD CONSTRAINT "_CommunicationAttachments_B_fkey" FOREIGN KEY ("B") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

