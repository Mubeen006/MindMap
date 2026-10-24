import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';

import { PrismaService } from '../../prisma/prisma.service';
import { ExtractionService } from '../../extraction/extraction.service';
import { TranscriptionService } from '../../transcription/transcription.service';
import { EnrichmentService } from '../../enrichment/enrichment.service';
import { CategoryTreeService } from '../../enrichment/category-tree.service';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { InstagramMessagingService } from '../../instagram-messaging/instagram-messaging.service';
import { MediaJobData } from '../queue.service';

@Processor('media-processing')
@Injectable()
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly extractionService: ExtractionService,
    private readonly transcriptionService: TranscriptionService,
    private readonly enrichmentService: EnrichmentService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly categoryTree: CategoryTreeService,
    private readonly instagramMessaging: InstagramMessagingService,
  ) {
    super();
  }

  async process(job: Job<MediaJobData>): Promise<void> {
    const { itemId, url, type, chatId, channel = 'TELEGRAM', igsid } = job.data;
    this.logger.log(`Processing ${type} job: ${itemId}`);

    await this.prisma.item.update({
      where: { id: itemId },
      data: { status: 'PROCESSING' },
    });

    try {
      if (type === 'REEL') {
        await this.processReel(itemId, url, chatId, channel, igsid);
      } else {
        await this.processResource(itemId, url, chatId, job.data.skipAutoLink, channel, igsid, job.data.author);
      }
    } catch (error) {
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 3;
      this.logger.error(
        `Job failed for ${itemId} (attempt ${currentAttempt}/${maxAttempts}): ${error.message}`,
      );
      await this.prisma.item.update({
        where: { id: itemId },
        data: { status: 'FAILED' },
      });

      if (currentAttempt >= maxAttempts) {
        const itemTypeLabel = type === 'REEL' ? 'reel' : 'resource';
        const isInstagram = channel === 'INSTAGRAM_BOT' || channel === 'INSTAGRAM_PERSONAL';
        const failMessage = isInstagram
          ? `❌ Failed to process ${itemTypeLabel}. Please check the link or try again later.`
          : `❌ Failed to process this *${itemTypeLabel}*. Please check the link or try again later.`;

        try {
          await this.notifyUser(channel, chatId ?? null, igsid ?? null, failMessage);
        } catch (notifyErr) {
          this.logger.warn(`Failed to send failure notification: ${notifyErr.message}`);
        }
      }

      throw error;
    }
  }

  private async processReel(
    itemId: string,
    url: string,
    chatId: number | undefined,
    channel: string,
    igsid: string | undefined,
  ): Promise<void> {
    const { audioPath, thumbnailUrl, caption, tmpDir, hasVideo, author } =
      await this.extractionService.extractReel(itemId, url);

    try {
      const transcript = await this.transcriptionService.transcribe(audioPath);
      const card = await this.enrichmentService.enrichReel(transcript, caption);

      const category = await this.categoryTree.resolveCategoryPath(
        card.category_parent,
        card.category_child,
      );

      const tagConnects = await this.resolveTags(card.tags);

      await this.prisma.item.update({
        where: { id: itemId },
        data: {
          title: card.title,
          author: author || null,
          problemSolved: card.problem_solved,
          keyPoints: card.key_points,
          toolsMentioned: card.tools_mentioned,
          prerequisites: card.prerequisites,
          transcript,
          transcriptFormatted: card.transcript_formatted || transcript,
          thumbnailUrl: thumbnailUrl || null,
          hasVideo,
          categoryId: category.id,
          tags: { connect: tagConnects },
          setupSteps: {
            create: card.setup_steps.map((s, i) => ({
              order: i,
              text: s.step,
              link: s.link,
            })),
          },
          status: 'DONE',
        },
      });

      try {
        const embeddingText = [
          card.title,
          card.problem_solved,
          card.key_points.join(' '),
          card.tools_mentioned.join(' '),
        ]
          .filter(Boolean)
          .join(' ');
        const embedding = await this.embeddingsService.embed(embeddingText);
        await this.storeEmbedding(itemId, embedding);
      } catch (embErr) {
        this.logger.warn(`Embedding skipped for ${itemId}: ${embErr.message}`);
      }

      const categoryLabel = category.name;
      const points = card.key_points.map((p) => `• ${p}`).join('\n');
      const toolsLine = card.tools_mentioned.length
        ? `\n🔧 ${card.tools_mentioned.join(', ')}`
        : '';

      const isInstagram = channel === 'INSTAGRAM_BOT' || channel === 'INSTAGRAM_PERSONAL';
      const notificationText = isInstagram
        ? `${card.title}\n${categoryLabel}${toolsLine ? `\nTools: ${card.tools_mentioned.join(', ')}` : ''}\n\n${points}`
        : `✅ *${card.title}*\n📂 ${categoryLabel}${toolsLine}\n\n${points}`;

      const sentMessageId = await this.notifyUser(channel, chatId ?? null, igsid ?? null, notificationText);

      if (sentMessageId) {
        await this.prisma.item.update({
          where: { id: itemId },
          data: isInstagram
            ? { igMessageId: String(sentMessageId) }
            : { telegramMessageId: Number(sentMessageId) },
        });
      }
    } finally {
      this.extractionService.cleanup(tmpDir);
    }
  }

  private async processResource(
    itemId: string,
    url: string,
    chatId: number | undefined,
    skipAutoLink = false,
    channel = 'TELEGRAM',
    igsid?: string,
    author?: string,
  ): Promise<void> {
    let title = url;
    let description = '';
    let imageUrl = '';

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(12000),
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      title = $('meta[property="og:title"]').attr('content') || $('title').text() || url;
      description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';
      imageUrl = $('meta[property="og:image"]').attr('content') || '';
    } catch (e) {
      this.logger.warn(`Could not fetch OG metadata for ${url}: ${e.message}`);
    }

    let relatedToId: string | null = null;

    if (skipAutoLink) {
      const existing = await this.prisma.item.findUnique({ where: { id: itemId } });
      relatedToId = existing?.relatedToId ?? null;
    } else {
      const recentReel = await this.prisma.item.findFirst({
        where: { type: 'REEL', createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
      });
      relatedToId = recentReel?.id || null;
    }

    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        title: title.slice(0, 255),
        author: author || null,
        thumbnailUrl: imageUrl || null,
        transcript: description || null,
        relatedToId,
        status: 'DONE',
      },
    });

    const linkedReel = relatedToId
      ? await this.prisma.item.findUnique({ where: { id: relatedToId } })
      : null;
    const linkMsg = linkedReel
      ? `\n🔗 Linked to: *${linkedReel.title || 'recent reel'}*`
      : '\n⚠️ No recent reel to link (saved standalone — link it manually later)';

    const isInstagram = channel === 'INSTAGRAM_BOT' || channel === 'INSTAGRAM_PERSONAL';
    const resourceText = isInstagram
      ? `Resource saved: ${title.slice(0, 120)}${linkMsg.replace(/\*/g, '')}`
      : `✅ Resource saved!\n📌 *${title.slice(0, 120)}*${linkMsg}`;

    await this.notifyUser(channel, chatId ?? null, igsid ?? null, resourceText);
  }

  private async resolveTags(tags: string[]): Promise<Array<{ id: string }>> {
    const result: Array<{ id: string }> = [];
    for (const tagName of tags) {
      const tag = await this.prisma.tag.upsert({
        where: { name: tagName.toLowerCase() },
        create: { name: tagName.toLowerCase() },
        update: {},
      });
      result.push({ id: tag.id });
    }
    return result;
  }

  private async storeEmbedding(itemId: string, embedding: number[]): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE "Item"
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${itemId}
    `;
  }

  private async notifyUser(
    channel: string,
    chatId: number | null,
    igsid: string | null,
    text: string,
  ): Promise<string | number | null> {
    if (channel === 'INSTAGRAM_BOT' || channel === 'INSTAGRAM_PERSONAL') {
      const notifyIgsid =
        channel === 'INSTAGRAM_PERSONAL'
          ? this.getOwnerIgsid(igsid)
          : (igsid || this.getOwnerIgsid());

      if (!notifyIgsid) return null;
      return this.instagramMessaging.sendMessage(
        'INSTAGRAM_BOT',
        notifyIgsid,
        text,
      );
    }
    return this.sendTelegramMessage(chatId, text);
  }

  private getOwnerIgsid(fallback?: string | null): string | null {
    const configured = this.config.get<string>('IG_NOTIFY_IGSID');
    if (configured) return configured.trim();
    const allowed = this.config.get<string>('ALLOWED_IG_SENDER_IDS');
    if (allowed) {
      const first = allowed.split(',')[0]?.trim();
      if (first) return first;
    }
    return fallback ?? null;
  }

  private async sendTelegramMessage(chatId: number | null, text: string): Promise<number | null> {
    if (!chatId) return null;
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return data?.result?.message_id ?? null;
    } catch (e) {
      this.logger.warn(`Failed to send Telegram notification to ${chatId}: ${e.message}`);
      return null;
    }
  }
}
