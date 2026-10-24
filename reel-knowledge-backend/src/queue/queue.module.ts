import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { MediaProcessor } from './processors/media.processor';
import { TmpCleanupService } from './processors/tmp-cleanup.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { InstagramMessagingModule } from '../instagram-messaging/instagram-messaging.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'media-processing' }),
    ExtractionModule,
    TranscriptionModule,
    EnrichmentModule,
    EmbeddingsModule,
    InstagramMessagingModule,
  ],
  providers: [QueueService, MediaProcessor, TmpCleanupService],
  exports: [QueueService],
})
export class QueueModule {}
