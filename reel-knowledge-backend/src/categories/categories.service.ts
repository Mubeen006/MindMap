import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const topLevel = await this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: { include: { _count: { select: { items: true } } } },
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    return topLevel.map((c) => {
      const childRollup = c.children.reduce((sum, ch) => sum + ch._count.items, 0);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        itemCount: c._count.items + childRollup,
        children: c.children.map((ch) => ({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          itemCount: ch._count.items,
        })),
      };
    });
  }
}
