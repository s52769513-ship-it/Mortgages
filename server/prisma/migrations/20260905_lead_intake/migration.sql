-- What the office asks a lead on the first call. Everything here is the
-- client's own account of their situation; nothing is verified yet.

CREATE TYPE "ClientPriority" AS ENUM ('SERVICE', 'RATES', 'TIMELINE', 'OTHER');
CREATE TYPE "Availability" AS ENUM ('ANYTIME', 'WORK_HOURS', 'EVENINGS', 'LIMITED');

ALTER TABLE "Client"
  ADD COLUMN "partnerName"         TEXT,
  ADD COLUMN "partnerPhone"        TEXT,
  ADD COLUMN "declaredIncome"      DECIMAL(12,2),
  ADD COLUMN "declaredAssets"      TEXT,
  ADD COLUMN "declaredLiabilities" TEXT,
  ADD COLUMN "targetDate"          TIMESTAMP(3),
  ADD COLUMN "agreedFee"           DECIMAL(12,2),
  ADD COLUMN "priorities"          "ClientPriority"[] DEFAULT ARRAY[]::"ClientPriority"[],
  ADD COLUMN "prioritiesNote"      TEXT,
  ADD COLUMN "availEmail"          "Availability",
  ADD COLUMN "availWhatsapp"       "Availability",
  ADD COLUMN "availPhone"          "Availability";
