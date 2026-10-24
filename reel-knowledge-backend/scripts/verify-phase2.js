/**
 * Phase 2 verification script.
 * Tests: reel enrichment fields, category filter, item detail, resource auto-linking.
 */
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

const API = `http://localhost:${process.env.PORT || 3000}/api`;

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = new PrismaClient();
  const results = [];

  // 1. Reels have enriched fields
  const items = await apiGet('/items');
  const doneReels = items.filter((i) => i.type === 'REEL' && i.status === 'DONE');
  const enriched = doneReels.filter(
    (i) => i.title && i.keyPoints?.length >= 3 && i.transcript && i.category,
  );
  results.push({
    check: 'Reels enriched (title + keyPoints + transcript + category)',
    pass: enriched.length > 0,
    detail: `${enriched.length}/${doneReels.length} DONE reels fully enriched`,
  });

  // 2. Categories endpoint
  const categories = await apiGet('/categories');
  results.push({
    check: 'GET /categories returns itemCount',
    pass: categories.length > 0 && typeof categories[0].itemCount === 'number',
    detail: `${categories.length} categories`,
  });

  // 3. Category filter
  if (categories.length > 0) {
    const filtered = await apiGet(`/items?categoryId=${categories[0].id}`);
    results.push({
      check: 'GET /items?categoryId= filters correctly',
      pass: filtered.every((i) => i.categoryId === categories[0].id),
      detail: `${filtered.length} items in "${categories[0].name}"`,
    });
  }

  // 4. Item detail with resources array
  if (doneReels.length > 0) {
    const detail = await apiGet(`/items/${doneReels[0].id}`);
    results.push({
      check: 'GET /items/:id includes transcript + resources',
      pass: !!detail.transcript && Array.isArray(detail.resources),
      detail: `transcript=${detail.transcript?.length} chars, resources=${detail.resources?.length}`,
    });
  }

  // 5. M9 — Resource auto-linking to recent reel
  const recentReel = await prisma.item.findFirst({
    where: { type: 'REEL', status: 'DONE' },
    orderBy: { createdAt: 'desc' },
  });

  if (recentReel) {
    const testUrl = 'https://example.com/phase2-resource-test';
    const resource = await prisma.item.create({
      data: {
        type: 'RESOURCE',
        sourceUrl: testUrl,
        status: 'PENDING',
        chatId: recentReel.chatId,
      },
    });

    const queue = new Queue('media-processing', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    });

    await queue.add(
      'process',
      {
        itemId: resource.id,
        url: testUrl,
        type: 'RESOURCE',
        chatId: recentReel.chatId ? Number(recentReel.chatId) : 0,
      },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 200 },
    );
    await queue.close();

    // Wait for worker to process
    let processed = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      processed = await prisma.item.findUnique({ where: { id: resource.id } });
      if (processed.status === 'DONE' || processed.status === 'FAILED') break;
    }

    results.push({
      check: 'M9: Resource auto-links to recent reel',
      pass: processed?.status === 'DONE' && processed?.relatedToId === recentReel.id,
      detail: `status=${processed?.status}, relatedToId=${processed?.relatedToId}, expected=${recentReel.id}`,
    });

    // Cleanup test resource
    await prisma.item.delete({ where: { id: resource.id } }).catch(() => {});
  }

  await prisma.$disconnect();

  console.log('\n=== Phase 2 Verification ===\n');
  let allPass = true;
  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.check}`);
    console.log(`       ${r.detail}\n`);
    if (!r.pass) allPass = false;
  }

  console.log(allPass ? 'Phase 2 checkpoint: PASSED' : 'Phase 2 checkpoint: FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
