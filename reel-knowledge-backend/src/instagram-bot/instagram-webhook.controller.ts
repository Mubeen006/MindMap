import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { InstagramCaptureService } from './instagram-capture.service';

@Controller('instagram/webhook')
export class InstagramWebhookController {
  private readonly logger = new Logger(InstagramWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly captureService: InstagramCaptureService,
  ) {}

  @Get()
  verify(@Query() query: Record<string, string>, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === expectedToken) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  @Post()
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Res() res: Response) {
    const signature = (req.headers['x-hub-signature-256'] || req.headers['x-hub-signature']) as string;
    const appSecret = this.config.get<string>('META_APP_SECRET');
    const rawBody = req.rawBody || (req.body ? Buffer.from(JSON.stringify(req.body)) : undefined);

    if (!rawBody || !this.verifySignature(rawBody, signature, appSecret)) {
      this.logger.warn('Rejected Instagram webhook: invalid or missing signature');
      res.sendStatus(401);
      return;
    }

    res.sendStatus(200);
    this.captureService.handleWebhookEvent(req.body).catch((e) => {
      this.logger.error(`Failed to process Instagram webhook event: ${e.message}`);
    });
  }

  private verifySignature(rawBody: Buffer, signatureHeader: string, appSecret: string): boolean {
    if (!signatureHeader || !appSecret) {
      this.logger.warn(
        `Signature check failed: missing ${!signatureHeader ? 'signature header' : 'META_APP_SECRET in .env'}`,
      );
      return false;
    }
    try {
      if (signatureHeader.startsWith('sha256=')) {
        const expectedHash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
        const expected = Buffer.from(`sha256=${expectedHash}`);
        const actual = Buffer.from(signatureHeader);
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
          this.logger.warn(
            `SHA-256 Signature mismatch! Check META_APP_SECRET in .env.`,
          );
          return false;
        }
        return true;
      }

      if (signatureHeader.startsWith('sha1=')) {
        const expectedHash = crypto.createHmac('sha1', appSecret).update(rawBody).digest('hex');
        const expected = Buffer.from(`sha1=${expectedHash}`);
        const actual = Buffer.from(signatureHeader);
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
          this.logger.warn(
            `SHA-1 Signature mismatch! Check META_APP_SECRET in .env.`,
          );
          return false;
        }
        return true;
      }

      return false;
    } catch (e) {
      this.logger.warn(`Signature verification exception: ${e.message}`);
      return false;
    }
  }
}
