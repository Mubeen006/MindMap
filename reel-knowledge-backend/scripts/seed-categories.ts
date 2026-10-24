import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_TAXONOMY: Record<string, string[]> = {
  'AI Tools & Models': ['Claude', 'ChatGPT / OpenAI', 'Cursor', 'Prompt Engineering'],
  'Web Development': ['React / Next.js', 'Backend & APIs', 'Databases', 'DevOps'],
  'Career & Freelancing': [],
  'Productivity & Workflow': [],
  'Design & UI/UX': [],
};

async function main() {
  for (const [parentName, children] of Object.entries(SEED_TAXONOMY)) {
    const existing = await prisma.category.findFirst({
      where: { name: parentName, parentId: null },
    });

    const parent =
      existing ??
      (await prisma.category.create({
        data: { name: parentName },
      }));

    for (const childName of children) {
      const childExists = await prisma.category.findFirst({
        where: { name: childName, parentId: parent.id },
      });
      if (!childExists) {
        await prisma.category.create({
          data: { name: childName, parentId: parent.id },
        });
      }
    }
  }
  console.log('✅ Seeded starting taxonomy');
  await prisma.$disconnect();
}

main();
