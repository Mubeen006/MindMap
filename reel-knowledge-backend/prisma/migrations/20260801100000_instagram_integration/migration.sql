-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('TELEGRAM', 'INSTAGRAM_BOT', 'INSTAGRAM_PERSONAL');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "channel" "Channel" NOT NULL DEFAULT 'TELEGRAM';
ALTER TABLE "Item" ADD COLUMN "igsid" TEXT;
ALTER TABLE "Item" ADD COLUMN "igMessageId" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
