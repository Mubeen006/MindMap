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

async function callGroq(categoryName, keyPoints) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'qwen/qwen3.6-27b',
      messages: [
        {
          role: 'system',
          content:
            'Write a concise 2-3 sentence overview paragraph summarizing what this personal knowledge category covers overall. Plain text only, no bullet points.',
        },
        {
          role: 'user',
          content: `Category: ${categoryName}\n\nKey points from saved reels:\n${keyPoints.join('\n')}`,
        },
      ],
      temperature: 0.4,
    }),
  });
  if (!response.ok) throw new Error(`Groq failed: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function main() {
  const prisma = new PrismaClient();
  const categories = await prisma.category.findMany({
    include: {
      items: {
        where: { status: 'DONE' },
        select: { title: true, keyPoints: true },
      },
    },
  });

  let count = 0;
  for (const category of categories) {
    if (category.items.length === 0) continue;
    const points = category.items.flatMap((item) =>
      item.keyPoints.map((p) => `- ${p} (from: ${item.title || 'untitled'})`),
    );
    const description = await callGroq(category.name, points);
    await prisma.category.update({
      where: { id: category.id },
      data: { description },
    });
    console.log(`Updated "${category.name}": ${description.slice(0, 80)}...`);
    count++;
  }

  console.log(`Done. Generated ${count} category overview(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
