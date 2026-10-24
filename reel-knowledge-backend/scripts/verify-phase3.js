/**
 * Phase 3 verification script.
 * Tests: vector column, embeddings present, semantic search, category overviews.
 */
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

const API = `http://localhost:${process.env.PORT || 3000}/api`;

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function main() {
  const prisma = new PrismaClient();
  const results = [];

  // 1. Vector column exists
  try {
    const cols = await prisma.$queryRaw`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'Item' AND column_name = 'embedding'
    `;
    results.push({
      check: 'Item.embedding vector(768) column exists',
      pass: cols.length === 1 && cols[0].udt_name === 'vector',
      detail: cols[0] ? `${cols[0].column_name} (${cols[0].udt_name})` : 'missing',
    });
  } catch (e) {
    results.push({ check: 'Item.embedding vector(768) column exists', pass: false, detail: e.message });
  }

  // 2. HNSW index exists
  try {
    const idx = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'Item' AND indexname = 'item_embedding_hnsw_idx'
    `;
    results.push({
      check: 'HNSW index item_embedding_hnsw_idx exists',
      pass: idx.length === 1,
      detail: idx[0]?.indexname || 'missing',
    });
  } catch (e) {
    results.push({ check: 'HNSW index exists', pass: false, detail: e.message });
  }

  // 3. DONE reels have embeddings
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total,
             COUNT(embedding)::int AS with_embedding
      FROM "Item"
      WHERE status = 'DONE' AND type = 'REEL'
    `;
    const { total, with_embedding } = rows[0];
    results.push({
      check: 'DONE reels have embeddings',
      pass: total > 0 && with_embedding === total,
      detail: `${with_embedding}/${total} embedded`,
    });
  } catch (e) {
    results.push({ check: 'DONE reels have embeddings', pass: false, detail: e.message });
  }

  // 4. Semantic search returns results
  try {
    const search = await apiGet('/search?q=' + encodeURIComponent('claude skills productivity'));
    results.push({
      check: 'GET /search?q= returns ranked results',
      pass: Array.isArray(search) && search.length > 0 && typeof search[0].distance === 'number',
      detail: search.length ? `top: "${search[0].title}" (distance=${Number(search[0].distance).toFixed(3)})` : 'no results',
    });
  } catch (e) {
    results.push({ check: 'GET /search?q= returns ranked results', pass: false, detail: e.message });
  }

  // 5. Categories have AI overview descriptions
  try {
    const categories = await apiGet('/categories');
    const withDesc = categories.filter((c) => c.description && c.description.length > 20);
    results.push({
      check: 'Categories have AI overview (description)',
      pass: withDesc.length > 0,
      detail: `${withDesc.length}/${categories.length} categories with description`,
    });
  } catch (e) {
    results.push({ check: 'Categories have AI overview', pass: false, detail: e.message });
  }

  // 6. Unlinked resources endpoint
  try {
    const unlinked = await apiGet('/items/unlinked');
    results.push({
      check: 'GET /items/unlinked works',
      pass: Array.isArray(unlinked),
      detail: `${unlinked.length} unlinked resource(s)`,
    });
  } catch (e) {
    results.push({ check: 'GET /items/unlinked works', pass: false, detail: e.message });
  }

  await prisma.$disconnect();

  console.log('\n=== Phase 3 Verification ===\n');
  let allPass = true;
  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.check}`);
    console.log(`       ${r.detail}\n`);
    if (!r.pass) allPass = false;
  }

  console.log(allPass ? 'Phase 3 checkpoint: PASSED' : 'Phase 3 checkpoint: FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
