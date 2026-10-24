const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

async function main() {
  const prisma = new PrismaClient();
  const queue = new Queue('media-processing', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    },
  });

  const items = await prisma.item.findMany({
    where: { status: { in: ['FAILED', 'PROCESSING', 'PENDING'] } },
    orderBy: { createdAt: 'asc' },
  });

  if (items.length === 0) {
    console.log('No items to reprocess.');
    await queue.close();
    await prisma.$disconnect();
    return;
  }

  for (const item of items) {
    await prisma.item.update({
      where: { id: item.id },
      data: { status: 'PENDING' },
    });

    await queue.add(
      'process',
      {
        itemId: item.id,
        url: item.sourceUrl,
        type: item.type,
        chatId: item.chatId ? Number(item.chatId) : 0,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    console.log(`Requeued ${item.id} (${item.type}, was ${item.status})`);
  }

  await queue.close();
  await prisma.$disconnect();
  console.log(`Done. Requeued ${items.length} item(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
