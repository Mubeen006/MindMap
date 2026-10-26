import { Controller, Get, Param, Query, Patch, Post, Delete, Body, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async findAll(@Query('categoryId') categoryId?: string) {
    return this.itemsService.findAll(categoryId);
  }

  @Get('unlinked')
  async findUnlinked() {
    return this.itemsService.findUnlinkedResources();
  }

  @Get('incomplete')
  async findIncomplete() {
    return this.itemsService.findIncomplete();
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.itemsService.retry(id);
  }

  @Post(':id/resources')
  async addResource(@Param('id') id: string, @Body('url') url: string) {
    return this.itemsService.addManualResource(id, url);
  }

  @Patch(':id/link')
  async linkResource(@Param('id') id: string, @Body('relatedToId') relatedToId: string) {
    return this.itemsService.linkResource(id, relatedToId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.itemsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }

  @Get(':id/video')
  async streamVideo(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    await this.itemsService.streamVideo(id, req, res);
  }

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @Res() res: Response) {
    await this.itemsService.streamThumbnail(id, res);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }
}
