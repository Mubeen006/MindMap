import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly config: ConfigService,
  ) {}

  async search(query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    const queryEmbedding = await this.embeddingsService.embed(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const maxDistance = parseFloat(this.config.get<string>('SEARCH_MAX_DISTANCE') ?? '0.65');

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        thumbnailUrl: string | null;
        categoryId: string | null;
        distance: number;
      }>
    >`
      SELECT id, title, "thumbnailUrl", "categoryId",
             embedding <=> ${embeddingStr}::vector AS distance
      FROM "Item"
      WHERE status = 'DONE' AND embedding IS NOT NULL AND type = 'REEL'
        AND (embedding <=> ${embeddingStr}::vector) < ${maxDistance}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 10
    `;

    this.logger.debug(
      `Search "${query}" → ${results.length} result(s), distances: ${results.map((r) => r.distance.toFixed(3)).join(', ') || 'none'}`,
    );

    return results;
  }
}
