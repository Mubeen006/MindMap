import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // GET /api/search?q=my+list+scrolling+is+laggy
  @Get()
  async search(@Query('q') q: string) {
    return this.searchService.search(q);
  }
}
