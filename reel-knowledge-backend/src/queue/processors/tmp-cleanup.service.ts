import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class TmpCleanupService {
  private readonly logger = new Logger(TmpCleanupService.name);
  private readonly MAX_AGE_MS = 2 * 60 * 60 * 1000;

  @Cron(CronExpression.EVERY_HOUR)
  async sweepOrphanedTmpFolders(): Promise<void> {
    const tmpRoot = os.tmpdir();
    let entries: string[];
    try {
      entries = fs.readdirSync(tmpRoot);
    } catch {
      return;
    }

    const now = Date.now();
    let removed = 0;

    for (const entry of entries) {
      if (!entry.startsWith('reel-')) continue;
      const fullPath = path.join(tmpRoot, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > this.MAX_AGE_MS) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // Folder may have been removed between readdir and stat — ignore
      }
    }

    if (removed > 0) {
      this.logger.log(`Swept ${removed} orphaned temp folder(s)`);
    }
  }
}
