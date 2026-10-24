import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class InstagramTokenRefreshService {
  private readonly logger = new Logger(InstagramTokenRefreshService.name);

  constructor(private readonly settings: SettingsService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async refreshTokens(): Promise<void> {
    await this.refreshOne('IG_BOT_ACCESS_TOKEN');
    await this.refreshOne('IG_PERSONAL_ACCESS_TOKEN');
  }

  private async refreshOne(settingKey: string): Promise<void> {
    const currentToken = await this.settings.get(settingKey);
    if (!currentToken) return;

    try {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`,
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

      const data = await res.json();
      if (data.access_token) {
        await this.settings.set(settingKey, data.access_token);
        this.logger.log(`Refreshed ${settingKey}`);
      }
    } catch (e) {
      this.logger.warn(`Token refresh failed for ${settingKey}: ${e.message}`);
    }
  }
}
