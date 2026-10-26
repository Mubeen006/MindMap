import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { InstagramMessagingService } from '../instagram-messaging/instagram-messaging.service';

const REEL_REGEX = /(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|tv|share\/reel)\/[A-Za-z0-9_.-]+/i;

@Injectable()
export class InstagramCaptureService {
  private readonly logger = new Logger(InstagramCaptureService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly instagramMessaging: InstagramMessagingService,
  ) {}

  async handleWebhookEvent(body: any): Promise<void> {
    if (body?.object !== 'instagram') return;

    this.logger.log(`📥 Instagram webhook received: ${JSON.stringify(body)}`);

    for (const entry of body.entry ?? []) {
      const receivingAccountId = String(entry.id ?? '').trim();
      for (const event of entry.messaging ?? []) {
        await this.handleMessagingEvent(receivingAccountId, event);
      }
    }
  }

  private async handleMessagingEvent(receivingAccountId: string, event: any): Promise<void> {
    const senderIgsid: string | undefined = event.sender?.id ? String(event.sender.id).trim() : undefined;
    const recipientIgsid: string | undefined = event.recipient?.id ? String(event.recipient.id).trim() : undefined;
    const message = event.message;

    if (!message || !senderIgsid) {
      return;
    }

    const botAccountId = String(this.config.get<string>('IG_BOT_ACCOUNT_ID') ?? '').trim();
    const personalAccountId = String(this.config.get<string>('IG_PERSONAL_ACCOUNT_ID') ?? '').trim();

    // Skip echo events of messages sent by the bot itself to prevent rejection feedback loops
    if (senderIgsid === botAccountId || (message.is_echo && receivingAccountId === botAccountId)) {
      return;
    }

    this.logger.log(
      `📩 Event: sender=${senderIgsid} -> recipient=${recipientIgsid}, receivingAccount=${receivingAccountId} (botId=${botAccountId}, personalId=${personalAccountId})`,
    );

    if (botAccountId && receivingAccountId === botAccountId) {
      await this.handleBotAccountMessage(senderIgsid, message);
    } else if (personalAccountId && receivingAccountId === personalAccountId) {
      await this.handlePersonalAccountMessage(senderIgsid, recipientIgsid, message);
    } else {
      // If receivingAccountId is not strictly matching either or if only one account exists, route to bot handler
      this.logger.warn(
        `⚠️ receivingAccountId (${receivingAccountId}) did not match bot (${botAccountId}) or personal (${personalAccountId}). Routing to Bot handler by default.`,
      );
      await this.handleBotAccountMessage(senderIgsid, message);
    }
  }

  private async handleBotAccountMessage(senderIgsid: string, message: any): Promise<void> {
    // 1. Strict Authorization check: only authorized senders may use the Bot
    if (!this.isAuthorizedSender(senderIgsid)) {
      this.logger.warn(`🚫 Unauthorized sender ${senderIgsid} messaged the bot. Rejecting.`);
      await this.instagramMessaging.sendMessage(
        'INSTAGRAM_BOT',
        senderIgsid,
        'Thanks for messaging! This account is private and not for public use.',
      );
      return;
    }

    const text = typeof message.text === 'string' ? message.text.trim() : '';

    // 2. Check if message is a /done trigger in the Bot chat
    if (text.toLowerCase().startsWith('/done')) {
      await this.handleDoneCommandInBotChat(senderIgsid, text);
      return;
    }

    // 3. Normal Reel or Link capture
    const extracted = this.extractMediaInfo(message);
    if (!extracted.url) {
      this.logger.warn(`Could not extract URL from Instagram message: ${JSON.stringify(message)}`);
      return;
    }

    const isReel = extracted.isReel || REEL_REGEX.test(extracted.url);
    const type = isReel ? 'REEL' : 'RESOURCE';

    this.logger.log(`✨ Captured ${type} from Instagram Bot DM: ${extracted.url}`);

    const item = await this.prisma.item.create({
      data: {
        type,
        sourceUrl: extracted.url,
        status: 'PENDING',
        channel: 'INSTAGRAM_BOT',
        igsid: senderIgsid,
      },
    });

    await this.queueService.enqueue({
      itemId: item.id,
      url: extracted.url,
      type,
      channel: 'INSTAGRAM_BOT',
      igsid: senderIgsid,
    });

    const replyText = isReel
      ? '⏳ Reel received! Processing...'
      : '⏳ Resource link received! Processing...';

    await this.instagramMessaging.sendMessage('INSTAGRAM_BOT', senderIgsid, replyText);
  }

  private async handleDoneCommandInBotChat(senderIgsid: string, text: string): Promise<void> {
    const parts = text.split(/\s+/);
    const explicitUrlMatch = text.match(/https?:\/\/[^\s]+/);

    if (explicitUrlMatch) {
      const url = explicitUrlMatch[0].replace(/[.,;)]+$/, '');
      const item = await this.prisma.item.create({
        data: {
          type: 'RESOURCE',
          sourceUrl: url,
          status: 'PENDING',
          channel: 'INSTAGRAM_BOT',
          igsid: senderIgsid,
        },
      });

      await this.queueService.enqueue({
        itemId: item.id,
        url,
        type: 'RESOURCE',
        channel: 'INSTAGRAM_BOT',
        igsid: senderIgsid,
      });

      await this.instagramMessaging.sendMessage(
        'INSTAGRAM_BOT',
        senderIgsid,
        `⏳ Resource link received! Processing: ${url}`,
      );
      return;
    }

    // Process the most recent pending capture from personal account DMs
    const pending = await this.prisma.pendingCapture.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!pending) {
      await this.instagramMessaging.sendMessage(
        'INSTAGRAM_BOT',
        senderIgsid,
        '⚠️ No pending resource link found from personal DMs. Share a link directly or type /done <url>.',
      );
      return;
    }

    const item = await this.prisma.item.create({
      data: {
        type: 'RESOURCE',
        sourceUrl: pending.url,
        author: pending.senderUsername || pending.senderIgsid,
        status: 'PENDING',
        channel: 'INSTAGRAM_BOT',
        igsid: senderIgsid,
      },
    });

    await this.prisma.pendingCapture.delete({ where: { id: pending.id } });

    await this.queueService.enqueue({
      itemId: item.id,
      url: pending.url,
      type: 'RESOURCE',
      channel: 'INSTAGRAM_BOT',
      igsid: senderIgsid,
      author: pending.senderUsername || pending.senderIgsid,
    });

    await this.instagramMessaging.sendMessage(
      'INSTAGRAM_BOT',
      senderIgsid,
      `⏳ Processing resource from ${pending.senderUsername || 'pending DM'}: ${pending.url}`,
    );
  }

  private async handlePersonalAccountMessage(
    senderIgsid: string,
    recipientIgsid: string | undefined,
    message: any,
  ): Promise<void> {
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    const isOwnerSender = this.isAuthorizedSender(senderIgsid) || message.is_echo;

    // A. Owner triggered /done in a creator's chat on the personal account
    if (isOwnerSender && text.toLowerCase().startsWith('/done')) {
      const targetIgsid = recipientIgsid && !this.isAuthorizedSender(recipientIgsid)
        ? recipientIgsid
        : undefined;

      this.logger.log(`🎯 /done triggered by owner in chat with ${targetIgsid || 'latest'}`);

      let pending = targetIgsid
        ? await this.prisma.pendingCapture.findFirst({
            where: { senderIgsid: targetIgsid },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      if (!pending) {
        pending = await this.prisma.pendingCapture.findFirst({
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!pending) {
        this.logger.warn(`No pending resource link found for /done in conversation with ${targetIgsid}`);
        return;
      }

      const item = await this.prisma.item.create({
        data: {
          type: 'RESOURCE',
          sourceUrl: pending.url,
          author: pending.senderUsername || pending.senderIgsid,
          status: 'PENDING',
          channel: 'INSTAGRAM_PERSONAL',
          igsid: senderIgsid,
        },
      });

      await this.prisma.pendingCapture.delete({ where: { id: pending.id } });

      await this.queueService.enqueue({
        itemId: item.id,
        url: pending.url,
        type: 'RESOURCE',
        channel: 'INSTAGRAM_PERSONAL',
        igsid: senderIgsid,
        author: pending.senderUsername || pending.senderIgsid,
      });

      const notifyIgsid = this.getOwnerIgsid();
      if (notifyIgsid) {
        await this.instagramMessaging.sendMessage(
          'INSTAGRAM_BOT',
          notifyIgsid,
          `⏳ Resource link captured from ${pending.senderUsername || 'creator'}! Processing...`,
        );
      }
      return;
    }

    // B. Incoming message from external creator to personal account
    // Buffer the resource link for /done trigger. DO NOT send automated messages to creator!
    const extracted = this.extractMediaInfo(message);
    if (!extracted.url || extracted.isReel || REEL_REGEX.test(extracted.url)) {
      // Reels or plain text sent to personal inbox are left alone
      return;
    }

    this.logger.log(`📌 Buffering resource link from ${senderIgsid} for /done trigger: ${extracted.url}`);

    await this.prisma.pendingCapture.create({
      data: {
        senderIgsid,
        url: extracted.url,
        rawText: text || null,
      },
    });

    // NOTE: NEVER send automated replies to creators on the personal account.
  }

  private extractMediaInfo(message: any): { url: string | null; isReel: boolean } {
    // 1. Check message.text for an explicit URL
    if (message.text) {
      const textMatch = message.text.match(/https?:\/\/[^\s]+/);
      if (textMatch) {
        const url = textMatch[0].replace(/[.,;)]+$/, '');
        return { url, isReel: REEL_REGEX.test(url) };
      }
    }

    // 2. Check message.share (Instagram in-app share)
    if (message.share?.link) {
      const url = message.share.link;
      return { url, isReel: true };
    }
    if (message.share?.url) {
      const url = message.share.url;
      return { url, isReel: true };
    }

    // 3. Check message.attachments
    for (const att of message.attachments ?? []) {
      const isReelType =
        att.type === 'share' ||
        att.type === 'ig_reel' ||
        att.type === 'reel' ||
        att.type === 'video' ||
        att.type === 'media';

      // Check url / link in attachment payload
      if (att.payload?.url) {
        const url = att.payload.url;
        return { url, isReel: isReelType || REEL_REGEX.test(url) };
      }
      if (att.payload?.link) {
        const url = att.payload.link;
        return { url, isReel: isReelType || REEL_REGEX.test(url) };
      }

      // Check target_id / reel_id / id
      if (att.payload?.target_id) {
        return {
          url: `https://www.instagram.com/reel/${att.payload.target_id}/`,
          isReel: true,
        };
      }
      if (att.payload?.reel_id) {
        return {
          url: `https://www.instagram.com/reel/${att.payload.reel_id}/`,
          isReel: true,
        };
      }
      if (att.payload?.id && isReelType) {
        return {
          url: `https://www.instagram.com/p/${att.payload.id}/`,
          isReel: true,
        };
      }
    }

    // 4. Check story_share
    if (message.story_share?.link) {
      return { url: message.story_share.link, isReel: false };
    }

    return { url: null, isReel: false };
  }

  private isAuthorizedSender(senderIgsid: string): boolean {
    const cleanSender = String(senderIgsid).trim();
    if (!cleanSender) return false;

    const allowed = this.getAllowedSenderIds();
    return allowed.includes(cleanSender);
  }

  private getAllowedSenderIds(): string[] {
    const set = new Set<string>();

    const configuredList = this.config.get<string>('ALLOWED_IG_SENDER_IDS');
    if (configuredList) {
      for (const id of configuredList.split(',')) {
        const clean = id.trim();
        if (clean) set.add(clean);
      }
    }

    const personalAccountId = this.config.get<string>('IG_PERSONAL_ACCOUNT_ID');
    if (personalAccountId) {
      const clean = personalAccountId.trim();
      if (clean) set.add(clean);
    }

    const notifyIgsid = this.config.get<string>('IG_NOTIFY_IGSID');
    if (notifyIgsid) {
      const clean = notifyIgsid.trim();
      if (clean) set.add(clean);
    }

    return Array.from(set);
  }

  private getOwnerIgsid(): string | null {
    const configured = this.config.get<string>('IG_NOTIFY_IGSID');
    if (configured && configured.trim()) return configured.trim();

    const allowed = this.getAllowedSenderIds();
    return allowed.length > 0 ? allowed[0] : null;
  }
}
