-- Fields the office adds for itself, and the values a client holds for them.

CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

CREATE TABLE "CustomField" (
  "id"         TEXT NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "key"        TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "type"       "CustomFieldType" NOT NULL DEFAULT 'TEXT',
  "options"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomField_entityType_key_key" ON "CustomField"("entityType", "key");
CREATE INDEX "CustomField_entityType_position_idx" ON "CustomField"("entityType", "position");

-- Existing clients start with no values, not with a null nobody checks for.
ALTER TABLE "Client" ADD COLUMN "custom" JSONB NOT NULL DEFAULT '{}';
