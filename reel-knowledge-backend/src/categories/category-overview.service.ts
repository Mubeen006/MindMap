import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoryOverviewService {
  private readonly logger = new Logger(CategoryOverviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refreshStaleCategories(): Promise<void> {
    const categories = await this.prisma.category.findMany({
      include: {
        items: {
          where: { status: 'DONE' },
          select: { id: true },
        },
      },
    });

    for (const category of categories) {
      if (category.items.length === 0) continue;
      // Refresh when description is missing, or daily for categories that have items
      await this.generateForCategory(category.id, category.name);
    }
  }

  async generateForCategory(categoryId: string, categoryName?: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        items: {
          where: { status: 'DONE' },
          select: { title: true, keyPoints: true },
        },
      },
    });

    if (!category || category.items.length === 0) {
      throw new Error(`Category ${categoryId} has no DONE items`);
    }

    const name = categoryName || category.name;
    const allPoints = category.items.flatMap((item) =>
      item.keyPoints.map((p) => `- ${p} (from: ${item.title || 'untitled'})`),
    );

    const description = await this.callGroq(name, allPoints);

    await this.prisma.category.update({
      where: { id: categoryId },
      data: { description },
    });

    this.logger.log(`Updated overview for category "${name}"`);
    return description;
  }

  async generateAll(): Promise<number> {
    const categories = await this.prisma.category.findMany({
      where: { items: { some: { status: 'DONE' } } },
      select: { id: true, name: true },
    });

    for (const category of categories) {
      await this.generateForCategory(category.id, category.name);
    }

    return categories.length;
  }

  private async callGroq(categoryName: string, keyPoints: string[]): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');

    const model = this.config.get<string>('GROQ_MODEL') || 'qwen/qwen3.6-27b';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Groq category overview failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
}
