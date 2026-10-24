import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';
import { CategoryTreeService } from './category-tree.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EnrichmentService, CategoryTreeService],
  exports: [EnrichmentService, CategoryTreeService],
})
export class EnrichmentModule {}
