-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "BankBranch" ADD COLUMN     "city" TEXT,
ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateIndex
CREATE INDEX "BankBranch_bankId_city_idx" ON "BankBranch"("bankId", "city");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_bankId_code_key" ON "BankBranch"("bankId", "code");

