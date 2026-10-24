import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { assertPublicUrl } from '../common/url-safety';

export interface UpdateItemDto {
  title?: string;
  problemSolved?: string;
  keyPoints?: string[];
  toolsMentioned?: string[];
  prerequisites?: string[];
  tags?: string[];
  categoryId?: string;
  setupSteps?: { text: string; link?: string | null }[];
}

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async findAll(categoryId?: string) {
    return this.prisma.item.findMany({
      where: {
        type: 'REEL',
        status: 'DONE',
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { include: { parent: true } },
        tags: true,
        _count: { select: { setupSteps: true } },
      },
    });
  }

  async findIncomplete() {
    return this.prisma.item.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async retry(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    if (item.status !== 'FAILED') {
      throw new BadRequestException('Only FAILED items can be retried');
    }

    await this.prisma.item.update({ where: { id }, data: { status: 'PENDING' } });

    await this.queueService.enqueue({
      itemId: item.id,
      url: item.sourceUrl,
      type: item.type,
      channel: item.channel,
      chatId: item.chatId ? Number(item.chatId) : undefined,
      igsid: item.igsid ?? undefined,
    });

    return { id, status: 'PENDING' };
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: { include: { parent: true } },
        tags: true,
        relatedTo: true,
        resources: true,
        setupSteps: { orderBy: { order: 'asc' } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }

    return item;
  }

  async findUnlinkedResources() {
    return this.prisma.item.findMany({
      where: {
        type: 'RESOURCE',
        relatedToId: null,
        status: 'DONE',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { include: { parent: true } },
        tags: true,
        _count: { select: { setupSteps: true } },
      },
    });
  }

  async linkResource(resourceId: string, reelId: string) {
    const resource = await this.prisma.item.findUnique({ where: { id: resourceId } });
    if (!resource || resource.type !== 'RESOURCE') {
      throw new BadRequestException('Target item is not a resource');
    }
    const reel = await this.prisma.item.findUnique({ where: { id: reelId } });
    if (!reel || reel.type !== 'REEL') {
      throw new BadRequestException('Target link is not a reel');
    }

    return this.prisma.item.update({
      where: { id: resourceId },
      data: { relatedToId: reelId },
    });
  }

  async addManualResource(reelId: string, rawUrl: string) {
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 2048) {
      throw new BadRequestException('A valid URL is required');
    }

    const reel = await this.prisma.item.findUnique({ where: { id: reelId } });
    if (!reel || reel.type !== 'REEL') {
      throw new BadRequestException('Resources can only be attached to a reel');
    }

    let safeUrl: URL;
    try {
      safeUrl = await assertPublicUrl(rawUrl);
    } catch (e) {
      throw new BadRequestException(e.message);
    }

    let title = safeUrl.toString();
    let imageUrl = '';
    try {
      const res = await fetch(safeUrl.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      const html = await res.text();
      const $ = cheerio.load(html.slice(0, 500_000));
      title =
        $('meta[property="og:title"]').attr('content') || $('title').text() || safeUrl.toString();
      imageUrl = $('meta[property="og:image"]').attr('content') || '';
    } catch {
      // Metadata fetch failing shouldn't block saving the link itself
    }

    return this.prisma.item.create({
      data: {
        type: 'RESOURCE',
        sourceUrl: safeUrl.toString(),
        title: title.slice(0, 255),
        thumbnailUrl: imageUrl || null,
        relatedToId: reelId,
        status: 'DONE',
      },
    });
  }

  async update(id: string, rawDto: any) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Item ${id} not found`);

    const dto = this.validateUpdateDto(rawDto);

    if (dto.categoryId !== undefined && dto.categoryId !== '') {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new BadRequestException('Category not found');
    }

    let tagConnect: { id: string }[] | undefined;
    if (dto.tags !== undefined) {
      tagConnect = [];
      for (const name of dto.tags.slice(0, 10)) {
        const clean = name.trim().toLowerCase();
        if (!clean) continue;
        const tag = await this.prisma.tag.upsert({
          where: { name: clean },
          create: { name: clean },
          update: {},
        });
        tagConnect.push({ id: tag.id });
      }
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.problemSolved !== undefined ? { problemSolved: dto.problemSolved } : {}),
        ...(dto.keyPoints !== undefined ? { keyPoints: dto.keyPoints } : {}),
        ...(dto.toolsMentioned !== undefined ? { toolsMentioned: dto.toolsMentioned } : {}),
        ...(dto.prerequisites !== undefined ? { prerequisites: dto.prerequisites } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        ...(tagConnect ? { tags: { set: tagConnect } } : {}),
        ...(dto.setupSteps !== undefined
          ? {
              setupSteps: {
                deleteMany: {},
                create: dto.setupSteps.map((s, i) => ({
                  order: i,
                  text: s.text,
                  link: s.link || null,
                })),
              },
            }
          : {}),
      },
      include: {
        category: { include: { parent: true } },
        tags: true,
        setupSteps: { orderBy: { order: 'asc' } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Item ${id} not found`);
    await this.prisma.item.delete({ where: { id } });
    return { id, deleted: true };
  }

  async streamVideo(id: string, req: Request, res: Response): Promise<void> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item || !item.hasVideo) {
      res.status(404).json({ message: 'No video available for this item' });
      return;
    }

    const videoPath = path.join(process.cwd(), 'storage', 'videos', `${id}.mp4`);
    if (!fs.existsSync(videoPath)) {
      res.status(404).json({ message: 'Video file missing on disk' });
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (!range) {
      res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
      fs.createReadStream(videoPath).pipe(res);
      return;
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath, { start, end }).pipe(res);
  }

  private validateUpdateDto(dto: any): UpdateItemDto {
    const out: UpdateItemDto = {};

    if (dto.title !== undefined) {
      if (typeof dto.title !== 'string' || !dto.title.trim()) {
        throw new BadRequestException('title must be a non-empty string');
      }
      out.title = dto.title.trim().slice(0, 120);
    }
    if (dto.problemSolved !== undefined) {
      if (typeof dto.problemSolved !== 'string') {
        throw new BadRequestException('problemSolved must be a string');
      }
      out.problemSolved = dto.problemSolved.trim().slice(0, 500);
    }
    for (const field of ['keyPoints', 'toolsMentioned', 'prerequisites', 'tags'] as const) {
      if (dto[field] !== undefined) {
        if (!Array.isArray(dto[field]) || !dto[field].every((v: any) => typeof v === 'string')) {
          throw new BadRequestException(`${field} must be an array of strings`);
        }
        out[field] = dto[field]
          .map((v: string) => v.trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 10);
      }
    }
    if (dto.categoryId !== undefined) {
      if (typeof dto.categoryId !== 'string') {
        throw new BadRequestException('categoryId must be a string');
      }
      out.categoryId = dto.categoryId;
    }
    if (dto.setupSteps !== undefined) {
      if (!Array.isArray(dto.setupSteps)) {
        throw new BadRequestException('setupSteps must be an array');
      }
      out.setupSteps = dto.setupSteps.slice(0, 10).map((s: any) => {
        if (typeof s?.text !== 'string' || !s.text.trim()) {
          throw new BadRequestException('Each setup step needs non-empty text');
        }
        return {
          text: s.text.trim().slice(0, 300),
          link: typeof s.link === 'string' && s.link.trim() ? s.link.trim().slice(0, 500) : null,
        };
      });
    }

    return out;
  }
}
