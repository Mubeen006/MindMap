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
    const { accountId, accessToken, source, envToken, settingKey } = await this.getCredentials(channel);
    if (!accountId || !accessToken) {
      this.logger.warn(`Missing Instagram credentials for channel ${channel}`);
      return null;
    }

    try {
      let res = await this.executeSend(accountId, accessToken, igsid, text);

      // If DB token failed with 401 and .env has a different token, try the .env token and update DB
      if (res.status === 401 && source === 'db' && envToken && envToken !== accessToken) {
        this.logger.warn(
          `Instagram send 401 with DB token for ${channel}. Attempting fallback to .env token...`,
        );
        const retryRes = await this.executeSend(accountId, envToken, igsid, text);
        if (retryRes.ok) {
          this.logger.log(`Fallback to .env token succeeded. Syncing ${settingKey} into database.`);
          await this.settings.set(settingKey, envToken);
          const data = await retryRes.json();
          return data?.message_id ?? null;
        }
        res = retryRes;
      }

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

  private async executeSend(
    accountId: string,
    accessToken: string,
    igsid: string,
    text: string,
  ): Promise<Response> {
    return fetch(`https://graph.instagram.com/v24.0/${accountId}/messages`, {
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
  }

  private async getCredentials(channel: InstagramChannel): Promise<{
    accountId: string | null;
    accessToken: string | null;
    source: 'db' | 'env';
    envToken: string | null;
    settingKey: string;
  }> {
    const isBot = channel === 'INSTAGRAM_BOT';
    const settingKey = isBot ? 'IG_BOT_ACCESS_TOKEN' : 'IG_PERSONAL_ACCESS_TOKEN';
    const accountId =
      this.config.get<string>(isBot ? 'IG_BOT_ACCOUNT_ID' : 'IG_PERSONAL_ACCOUNT_ID') ?? null;
    const envToken = this.config.get<string>(settingKey) ?? null;
    const dbToken = await this.settings.get(settingKey);

    if (dbToken) {
      return { accountId, accessToken: dbToken, source: 'db', envToken, settingKey };
    }
    return { accountId, accessToken: envToken, source: 'env', envToken, settingKey };
  }
}
