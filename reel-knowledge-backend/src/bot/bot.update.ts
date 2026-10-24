import { Update, On, Ctx } from 'nestjs-telegraf';
import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

const REEL_REGEX = /instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+/;
const URL_REGEX = /https?:\/\/[^\s]+/;

@Update()
@Injectable()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @On('text')
  async onText(@Ctx() ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message || !('text' in message)) return;

    const text = message.text;
    const chatId = ctx.chat?.id;

    const urlMatch = text.match(URL_REGEX);
    if (!urlMatch) return;

    const url = urlMatch[0].replace(/[.,;)]+$/, '');
    const isReel = REEL_REGEX.test(url);
    const type = isReel ? 'REEL' : 'RESOURCE';

    let forcedRelatedToId: string | null = null;
    if (!isReel && 'reply_to_message' in message && message.reply_to_message) {
      const repliedToMessageId = message.reply_to_message.message_id;
      const targetReel = await this.prisma.item.findFirst({
        where: { telegramMessageId: repliedToMessageId, type: 'REEL' },
      });
      if (targetReel) {
        forcedRelatedToId = targetReel.id;
      }
    }

    try {
      const item = await this.prisma.item.create({
        data: {
          type,
          sourceUrl: url,
          status: 'PENDING',
          channel: 'TELEGRAM',
          chatId: chatId ? BigInt(chatId) : null,
          relatedToId: forcedRelatedToId,
        },
      });

      await this.queueService.enqueue({
        itemId: item.id,
        url,
        type,
        channel: 'TELEGRAM',
        chatId: chatId ?? 0,
        skipAutoLink: forcedRelatedToId !== null,
      });

      const replyText = forcedRelatedToId
        ? '🔗 Resource received — linked to that reel!'
        : isReel
          ? '⏳ Reel received! Processing...'
          : '⏳ Resource link received! Processing...';

      await ctx.reply(replyText);
    } catch (error) {
      this.logger.error(`Failed to save item: ${error.message}`);
      await ctx.reply('❌ Something went wrong. Please try again.');
    }
  }
}
