-- DropIndex
DROP INDEX "BankBranch_bankId_code_key";

-- CreateIndex
CREATE INDEX "BankBranch_bankId_code_idx" ON "BankBranch"("bankId", "code");

