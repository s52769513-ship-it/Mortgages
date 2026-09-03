-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'AGENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ON_HOLD', 'LOST');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHONE', 'EMAIL', 'SMS', 'WHATSAPP', 'MEETING');

-- CreateEnum
CREATE TYPE "FileStage" AS ENUM ('INTAKE', 'DOCUMENT_COLLECTION', 'BANK_SUBMISSION', 'APPROVAL_IN_PRINCIPLE', 'COLLATERAL', 'EXECUTION');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_BANK', 'WAITING_APPRAISER', 'WAITING_LAWYER', 'WAITING_OTHER', 'COMPLETED', 'CANCELLED', 'NOT_RELEVANT');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REQUIRED', 'REQUESTED', 'RECEIVED', 'UNDER_REVIEW', 'INVALID', 'MISSING', 'APPROVED', 'EXPIRED', 'NOT_RELEVANT');

-- CreateEnum
CREATE TYPE "BankApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCS', 'APPROVED_IN_PRINCIPLE', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ProfessionalRole" AS ENUM ('BANK_MANAGER', 'BANKER', 'APPRAISER', 'CLIENT_LAWYER', 'SELLER_LAWYER', 'DEVELOPER_LAWYER', 'SELLER', 'DEVELOPER', 'INSURANCE_AGENT', 'COURIER', 'ACCOUNTANT', 'OTHER_LENDER');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP', 'MEETING', 'LETTER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CLIENT', 'MORTGAGE_FILE', 'TASK', 'DOCUMENT', 'BANK_APPLICATION');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'FAILED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "phone" TEXT,
    "team" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "referralSource" TEXT,
    "referralDate" TIMESTAMP(3),
    "inquiryType" TEXT,
    "inquiryStatus" TEXT,
    "ownerId" TEXT,
    "preferredContact" "ContactMethod" NOT NULL DEFAULT 'PHONE',
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "introNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortgageFile" (
    "id" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,
    "agencyFee" DECIMAL(12,2),
    "dealType" TEXT,
    "propertyType" TEXT,
    "propertyAddress" TEXT,
    "purchasePrice" DECIMAL(14,2),
    "propertyValue" DECIMAL(14,2),
    "requestedAmount" DECIMAL(14,2),
    "ltvPercent" DECIMAL(5,2),
    "equity" DECIMAL(14,2),
    "desiredMonthly" DECIMAL(12,2),
    "requiredIncome" DECIMAL(12,2),
    "borrowersIncome" DECIMAL(12,2),
    "existingLiabilities" TEXT,
    "nextPaymentDate" TIMESTAMP(3),
    "executionDeadline" TIMESTAMP(3),
    "targetBankId" TEXT,
    "stage" "FileStage" NOT NULL DEFAULT 'INTAKE',
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "blockReason" TEXT,
    "lastAction" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MortgageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "stage" "FileStage",
    "ownerId" TEXT,
    "createdById" TEXT,
    "dueAt" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "triggerEvent" TEXT,
    "dependsOnId" TEXT,
    "waitingOn" TEXT,
    "description" TEXT,
    "escalationRule" TEXT,
    "result" TEXT,
    "completionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "fileId" TEXT,
    "clientId" TEXT,
    "periodLabel" TEXT,
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'REQUIRED',
    "isValid" BOOLEAN,
    "issueNotes" TEXT,
    "reviewedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "notes" TEXT,
    "allowedForBank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "swiftCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBranch" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banker" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Banker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankApplication" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "branchId" TEXT,
    "bankerId" TEXT,
    "managerName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submissionMethod" TEXT,
    "requestedAmount" DECIMAL(14,2),
    "ltvPercent" DECIMAL(5,2),
    "mixNotes" TEXT,
    "offeredRates" TEXT,
    "status" "BankApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "missingItems" TEXT,
    "creditCheck" TEXT,
    "approvalInPrinciple" BOOLEAN NOT NULL DEFAULT false,
    "approvalDate" TIMESTAMP(3),
    "approvalValidUntil" TIMESTAMP(3),
    "fileOpened" BOOLEAN NOT NULL DEFAULT false,
    "collateralReceived" BOOLEAN NOT NULL DEFAULT false,
    "sentToReview" BOOLEAN NOT NULL DEFAULT false,
    "sentToExecution" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalProfessional" (
    "id" TEXT NOT NULL,
    "role" "ProfessionalRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "organization" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalProfessional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileProfessional" (
    "fileId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "roleInFile" "ProfessionalRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileProfessional_pkey" PRIMARY KEY ("fileId","professionalId","roleInFile")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "direction" TEXT,
    "counterparty" TEXT,
    "type" "CommunicationType" NOT NULL,
    "subject" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "followUpTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeExpense" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "details" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'IN_APP',
    "remindAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TaskParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_email_idx" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Client_leadStatus_idx" ON "Client"("leadStatus");

-- CreateIndex
CREATE INDEX "Client_fullName_idx" ON "Client"("fullName");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "MortgageFile_fileNumber_key" ON "MortgageFile"("fileNumber");

-- CreateIndex
CREATE INDEX "MortgageFile_clientId_idx" ON "MortgageFile"("clientId");

-- CreateIndex
CREATE INDEX "MortgageFile_stage_idx" ON "MortgageFile"("stage");

-- CreateIndex
CREATE INDEX "MortgageFile_status_idx" ON "MortgageFile"("status");

-- CreateIndex
CREATE INDEX "MortgageFile_ownerId_idx" ON "MortgageFile"("ownerId");

-- CreateIndex
CREATE INDEX "Task_fileId_idx" ON "Task"("fileId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Document_fileId_idx" ON "Document"("fileId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_bankId_name_key" ON "BankBranch"("bankId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Banker_branchId_name_key" ON "Banker"("branchId", "name");

-- CreateIndex
CREATE INDEX "BankApplication_fileId_idx" ON "BankApplication"("fileId");

-- CreateIndex
CREATE INDEX "BankApplication_status_idx" ON "BankApplication"("status");

-- CreateIndex
CREATE INDEX "ExternalProfessional_role_idx" ON "ExternalProfessional"("role");

-- CreateIndex
CREATE INDEX "ExternalProfessional_name_idx" ON "ExternalProfessional"("name");

-- CreateIndex
CREATE INDEX "Communication_fileId_idx" ON "Communication"("fileId");

-- CreateIndex
CREATE INDEX "Communication_occurredAt_idx" ON "Communication"("occurredAt");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_createdAt_idx" ON "Comment"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "OfficeExpense_fileId_idx" ON "OfficeExpense"("fileId");

-- CreateIndex
CREATE INDEX "Reminder_status_remindAt_idx" ON "Reminder"("status", "remindAt");

-- CreateIndex
CREATE INDEX "_TaskParticipants_B_index" ON "_TaskParticipants"("B");

-- CreateIndex
CREATE INDEX "_TaskDocuments_B_index" ON "_TaskDocuments"("B");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageFile" ADD CONSTRAINT "MortgageFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageFile" ADD CONSTRAINT "MortgageFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageFile" ADD CONSTRAINT "MortgageFile_targetBankId_fkey" FOREIGN KEY ("targetBankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBranch" ADD CONSTRAINT "BankBranch_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banker" ADD CONSTRAINT "Banker_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "BankBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplication" ADD CONSTRAINT "BankApplication_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplication" ADD CONSTRAINT "BankApplication_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplication" ADD CONSTRAINT "BankApplication_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "BankBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplication" ADD CONSTRAINT "BankApplication_bankerId_fkey" FOREIGN KEY ("bankerId") REFERENCES "Banker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileProfessional" ADD CONSTRAINT "FileProfessional_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileProfessional" ADD CONSTRAINT "FileProfessional_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ExternalProfessional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeExpense" ADD CONSTRAINT "OfficeExpense_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MortgageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskParticipants" ADD CONSTRAINT "_TaskParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskParticipants" ADD CONSTRAINT "_TaskParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDocuments" ADD CONSTRAINT "_TaskDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDocuments" ADD CONSTRAINT "_TaskDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

