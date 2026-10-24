import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryOverviewService } from './category-overview.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryOverviewService],
  exports: [CategoryOverviewService],
})
export class CategoriesModule {}
