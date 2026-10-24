import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [oldName, newParentName, newChildName] = process.argv.slice(2);
  if (!oldName || !newParentName || !newChildName) {
    console.log('Usage: ts-node scripts/reconcile-category.ts "OldName" "New Parent" "New Child"');
    process.exit(1);
  }

  const oldCategory = await prisma.category.findFirst({
    where: { name: oldName, parentId: null },
  });
  if (!oldCategory) {
    console.log('Old category not found — nothing to do.');
    return;
  }

  let newParent = await prisma.category.findFirst({
    where: { name: newParentName, parentId: null },
  });
  if (!newParent) {
    newParent = await prisma.category.create({ data: { name: newParentName } });
  }

  let newChild = await prisma.category.findFirst({
    where: { name: newChildName, parentId: newParent.id },
  });
  if (!newChild) {
    newChild = await prisma.category.create({
      data: { name: newChildName, parentId: newParent.id },
    });
  }

  const moved = await prisma.item.updateMany({
    where: { categoryId: oldCategory.id },
    data: { categoryId: newChild.id },
  });
  await prisma.category.delete({ where: { id: oldCategory.id } });

  console.log(
    `Moved ${moved.count} item(s) from "${oldName}" into "${newParentName}" › "${newChildName}"`,
  );
  await prisma.$disconnect();
}

main();
