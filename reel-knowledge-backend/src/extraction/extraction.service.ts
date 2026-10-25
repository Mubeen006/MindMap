import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface ExtractionResult {
  audioPath: string;
  thumbnailUrl: string;
  caption: string;
  tmpDir: string;
  hasVideo: boolean;
  author?: string | null;
}

@Injectable()
export class ExtractionService implements OnModuleInit {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly STORAGE_DIR = path.join(process.cwd(), 'storage', 'videos');
  private ytDlpPath = 'yt-dlp';
  private ffmpegPath = 'ffmpeg';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.ytDlpPath = await this.resolveBinary(
      this.config.get<string>('YT_DLP_PATH'),
      'yt-dlp',
    );
    this.ffmpegPath = await this.resolveBinary(
      this.config.get<string>('FFMPEG_PATH'),
      'ffmpeg',
    );
    this.logger.log(`Using yt-dlp: ${this.ytDlpPath}`);
    this.logger.log(`Using ffmpeg: ${this.ffmpegPath}`);
  }

  async extractReel(itemId: string, url: string): Promise<ExtractionResult> {
    const tmpDir = path.join(os.tmpdir(), `reel-${itemId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const videoPath = path.join(tmpDir, 'video.mp4');
      const infoJsonPath = path.join(tmpDir, 'video.info.json');
      const audioPath = path.join(tmpDir, 'audio.mp3');

      await this.runYtDlp(url, tmpDir, videoPath);

      let caption = '';
      let thumbnailUrl = '';
      let author: string | null = null;
      try {
        const info = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
        caption = info.description || info.title || '';
        thumbnailUrl = info.thumbnail || '';
        author = info.uploader || info.channel || info.uploader_id || info.creator || null;
      } catch (e) {
        this.logger.warn(`Could not read info.json for ${itemId}: ${e.message}`);
      }

      await this.extractAudio(videoPath, audioPath);

      const hasVideo = this.persistVideo(itemId, videoPath);

      return { audioPath, thumbnailUrl, caption, tmpDir, hasVideo, author };
    } catch (error) {
      this.cleanup(tmpDir);
      throw error;
    }
  }

  private persistVideo(itemId: string, videoPath: string): boolean {
    try {
      fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
      const destPath = path.join(this.STORAGE_DIR, `${itemId}.mp4`);
      fs.copyFileSync(videoPath, destPath);
      return true;
    } catch (e) {
      this.logger.warn(`Could not persist video for ${itemId}: ${e.message}`);
      return false;
    }
  }

  private getCookieArgs(): string {
    const browserCookies = this.config.get<string>('YT_DLP_COOKIES_FROM_BROWSER');
    if (browserCookies) {
      return `--cookies-from-browser ${browserCookies}`;
    }
    const cookieFile = this.config.get<string>('YT_DLP_COOKIES_PATH') || path.join(process.cwd(), 'cookies.txt');
    if (fs.existsSync(cookieFile)) {
      return `--cookies ${this.q(cookieFile)}`;
    }
    return '';
  }

  private async runYtDlp(url: string, tmpDir: string, videoPath: string): Promise<void> {
    const cookieArgs = this.getCookieArgs();
    const cmd = `${this.q(this.ytDlpPath)} ${cookieArgs} --write-info-json --no-playlist -o ${this.q(videoPath)} ${this.q(url)}`.trim();

    try {
      await execAsync(cmd, { timeout: 120000, env: process.env, cwd: tmpDir });
    } catch (error) {
      this.logger.warn(`yt-dlp failed, attempting self-update then retry: ${error.message}`);

      try {
        await execAsync(`${this.q(this.ytDlpPath)} -U`, { timeout: 60000, env: process.env }).catch(async () => {
          await execAsync('python -m pip install -U yt-dlp', { timeout: 60000, env: process.env }).catch(() => {});
        });
      } catch {
        // Ignore update failure and continue to retry
      }

      try {
        await execAsync(cmd, { timeout: 120000, env: process.env, cwd: tmpDir });
      } catch (retryError) {
        throw new Error(`yt-dlp failed after retry: ${retryError.message}`);
      }
    }
  }

  private async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    const cmd = `${this.q(this.ffmpegPath)} -y -i ${this.q(videoPath)} -vn -acodec libmp3lame -q:a 4 ${this.q(audioPath)}`;
    await execAsync(cmd, { timeout: 60000, env: process.env });
  }

  private async resolveBinary(configPath: string | undefined, name: string): Promise<string> {
    if (configPath && fs.existsSync(configPath)) {
      return configPath;
    }

    const lookupCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    try {
      const { stdout } = await execAsync(lookupCmd, { timeout: 5000, env: process.env });
      const resolved = stdout.trim().split(/\r?\n/)[0];
      if (resolved && fs.existsSync(resolved)) {
        return resolved;
      }
    } catch {
      // Fall back to bare command name (works when PATH is set correctly).
    }

    return name;
  }

  private q(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  cleanup(tmpDir: string): void {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      this.logger.warn(`Cleanup failed for ${tmpDir}: ${e.message}`);
    }
  }
}
