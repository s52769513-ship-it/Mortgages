-- A client imported from an old list may have a name and no number. Keeping
-- the column required meant dropping the whole row, name included.
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
