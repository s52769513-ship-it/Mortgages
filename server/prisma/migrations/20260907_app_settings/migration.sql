-- Small, generic key/value table for office-wide settings, starting with the
-- financing-percent quick-pick list.

CREATE TABLE "AppSetting" (
  "key"       TEXT NOT NULL,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES ('ltvPresets', '[50, 60, 70, 75, 80]'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
