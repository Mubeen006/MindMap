import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [BotUpdate],
})
export class BotModule {}
