import { Module } from '@nestjs/common';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramCaptureService } from './instagram-capture.service';
import { QueueModule } from '../queue/queue.module';
import { InstagramMessagingModule } from '../instagram-messaging/instagram-messaging.module';

@Module({
  imports: [QueueModule, InstagramMessagingModule],
  controllers: [InstagramWebhookController],
  providers: [InstagramCaptureService],
})
export class InstagramBotModule {}
