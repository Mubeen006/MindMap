import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type MediaChannel = 'TELEGRAM' | 'INSTAGRAM_BOT' | 'INSTAGRAM_PERSONAL';

export interface MediaJobData {
  itemId: string;
  url: string;
  type: 'REEL' | 'RESOURCE';
  channel?: MediaChannel;
  chatId?: number;
  igsid?: string;
  author?: string;
  skipAutoLink?: boolean;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('media-processing') private readonly queue: Queue<MediaJobData>,
  ) {}

  async enqueue(data: MediaJobData): Promise<void> {
    await this.queue.add('process', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    this.logger.log(`Enqueued ${data.type} job for item ${data.itemId}`);
  }
}
