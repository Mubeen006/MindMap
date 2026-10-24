-- Drop unique constraint on Category.name (hierarchy allows duplicate names under different parents)
DROP INDEX IF EXISTS "Category_name_key";

-- Add hierarchical category support
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Structured enrichment v2 fields on Item
ALTER TABLE "Item" ADD COLUMN "problemSolved" TEXT;
ALTER TABLE "Item" ADD COLUMN "toolsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Item" ADD COLUMN "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Item" ADD COLUMN "transcriptFormatted" TEXT;
ALTER TABLE "Item" ADD COLUMN "telegramMessageId" INTEGER;

-- SetupStep model
CREATE TABLE "SetupStep" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,

    CONSTRAINT "SetupStep_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SetupStep" ADD CONSTRAINT "SetupStep_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
