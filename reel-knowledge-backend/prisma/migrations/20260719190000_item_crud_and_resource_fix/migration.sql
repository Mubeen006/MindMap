-- AlterForeignKey: set relatedToId to SET NULL when parent reel is deleted
ALTER TABLE "Item" DROP CONSTRAINT "Item_relatedToId_fkey";
ALTER TABLE "Item" ADD CONSTRAINT "Item_relatedToId_fkey" FOREIGN KEY ("relatedToId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
