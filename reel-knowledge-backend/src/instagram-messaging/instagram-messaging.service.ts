import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

type InstagramChannel = 'INSTAGRAM_BOT' | 'INSTAGRAM_PERSONAL';

@Injectable()
export class InstagramMessagingService {
  private readonly logger = new Logger(InstagramMessagingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async sendMessage(channel: InstagramChannel, igsid: string, text: string): Promise<string | null> {
    const { accountId, accessToken } = await this.getCredentials(channel);
    if (!accountId || !accessToken) {
      this.logger.warn(`Missing Instagram credentials for channel ${channel}`);
      return null;
    }

    try {
      const res = await fetch(`https://graph.instagram.com/v24.0/${accountId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: igsid },
          message: { text: text.slice(0, 1000) },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        this.logger.warn(`Instagram send failed (${channel}): ${res.status} ${await res.text()}`);
        return null;
      }

      const data = await res.json();
      return data?.message_id ?? null;
    } catch (e) {
      this.logger.warn(`Instagram send error (${channel}): ${e.message}`);
      return null;
    }
  }

  private async getCredentials(
    channel: InstagramChannel,
  ): Promise<{ accountId: string | null; accessToken: string | null }> {
    if (channel === 'INSTAGRAM_BOT') {
      return {
        accountId: this.config.get<string>('IG_BOT_ACCOUNT_ID') ?? null,
        accessToken: await this.settings.get('IG_BOT_ACCESS_TOKEN'),
      };
    }
    return {
      accountId: this.config.get<string>('IG_PERSONAL_ACCOUNT_ID') ?? null,
      accessToken: await this.settings.get('IG_PERSONAL_ACCESS_TOKEN'),
    };
  }
}
