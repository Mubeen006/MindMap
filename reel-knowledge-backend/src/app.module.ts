import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TelegrafModule } from 'nestjs-telegraf';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { BotModule } from './bot/bot.module';
import { QueueModule } from './queue/queue.module';
import { ExtractionModule } from './extraction/extraction.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ItemsModule } from './items/items.module';
import { CategoriesModule } from './categories/categories.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { InstagramBotModule } from './instagram-bot/instagram-bot.module';
import { InstagramMessagingModule } from './instagram-messaging/instagram-messaging.module';

@Module({
  imports: [
    // Config — isGlobal makes ConfigService available everywhere without re-importing
    ConfigModule.forRoot({ isGlobal: true }),

    // Schedule (for future cron jobs)
    ScheduleModule.forRoot(),

    // Telegram Bot
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        token: config.get<string>('TELEGRAM_BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),

    // BullMQ queue connected to Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // Application modules
    PrismaModule,
    BotModule,
    QueueModule,
    ExtractionModule,
    TranscriptionModule,
    EnrichmentModule,
    EmbeddingsModule,
    ItemsModule,
    CategoriesModule,
    SearchModule,
    SettingsModule,
    InstagramMessagingModule,
    InstagramBotModule,
  ],
})
export class AppModule {}
