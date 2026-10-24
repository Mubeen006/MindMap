import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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

const prisma = new PrismaClient();

async function main() {
  const botToken = process.env.IG_BOT_ACCESS_TOKEN;
  const personalToken = process.env.IG_PERSONAL_ACCESS_TOKEN;

  if (!botToken || !personalToken) {
    console.error('Set IG_BOT_ACCESS_TOKEN and IG_PERSONAL_ACCESS_TOKEN in .env first.');
    process.exit(1);
  }

  await prisma.setting.upsert({
    where: { key: 'IG_BOT_ACCESS_TOKEN' },
    create: { key: 'IG_BOT_ACCESS_TOKEN', value: botToken },
    update: { value: botToken },
  });
  await prisma.setting.upsert({
    where: { key: 'IG_PERSONAL_ACCESS_TOKEN' },
    create: { key: 'IG_PERSONAL_ACCESS_TOKEN', value: personalToken },
    update: { value: personalToken },
  });

  console.log('✅ Seeded Instagram access tokens into the Setting table');
  await prisma.$disconnect();
}

main();
