import { Module } from '@nestjs/common';
import { InstagramMessagingService } from './instagram-messaging.service';
import { InstagramTokenRefreshService } from './instagram-token-refresh.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [InstagramMessagingService, InstagramTokenRefreshService],
  exports: [InstagramMessagingService],
})
export class InstagramMessagingModule {}
