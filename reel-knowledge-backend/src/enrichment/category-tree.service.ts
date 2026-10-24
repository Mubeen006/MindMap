import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryNode {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

@Injectable()
export class CategoryTreeService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(): Promise<CategoryNode[]> {
    const topLevel = await this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });

    return topLevel.map((c) => ({
      id: c.id,
      name: c.name,
      children: c.children,
    }));
  }

  async formatTreeForPrompt(): Promise<string> {
    const tree = await this.getTree();
    if (tree.length === 0) return '(no categories yet — you are creating the first ones)';

    return tree
      .map((parent) => {
        const childLines = parent.children.map((c) => `  - ${c.name}`).join('\n');
        return childLines ? `${parent.name}\n${childLines}` : parent.name;
      })
      .join('\n');
  }

  async resolveCategoryPath(
    parentName: string,
    childName: string | null,
  ): Promise<{ id: string; name: string }> {
    const cleanParentName = parentName.trim();

    let parent = await this.prisma.category.findFirst({
      where: { name: { equals: cleanParentName, mode: 'insensitive' }, parentId: null },
    });

    if (!parent) {
      parent = await this.prisma.category.create({
        data: { name: cleanParentName },
      });
    }

    if (!childName || !childName.trim()) {
      return parent;
    }

    const cleanChildName = childName.trim();

    let child = await this.prisma.category.findFirst({
      where: {
        name: { equals: cleanChildName, mode: 'insensitive' },
        parentId: parent.id,
      },
    });

    if (!child) {
      child = await this.prisma.category.create({
        data: { name: cleanChildName, parentId: parent.id },
      });
    }

    return child;
  }
}
