const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

async function embed(text) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const response = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.embedding;
}

async function main() {
  const prisma = new PrismaClient();

  const items = await prisma.item.findMany({
    where: { status: 'DONE', type: 'REEL', title: { not: null } },
    select: { id: true, title: true, keyPoints: true },
  });

  const missing = [];
  for (const item of items) {
    const row = await prisma.$queryRaw`
      SELECT embedding IS NOT NULL AS has_embedding
      FROM "Item"
      WHERE id = ${item.id}
    `;
    if (!row[0]?.has_embedding) missing.push(item);
  }

  if (missing.length === 0) {
    console.log('All DONE reels already have embeddings.');
    await prisma.$disconnect();
    return;
  }

  for (const item of missing) {
    const text = `${item.title} ${item.keyPoints.join(' ')}`;
    const embedding = await embed(text);
    const embeddingStr = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
      UPDATE "Item"
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${item.id}
    `;
    console.log(`Embedded ${item.id}: "${item.title}"`);
  }

  console.log(`Done. Backfilled ${missing.length} embedding(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
