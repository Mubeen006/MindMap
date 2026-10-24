import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audioPath: string): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');

    const fileBuffer = fs.readFileSync(audioPath);
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), 'audio.mp3');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq transcription failed: ${response.status} ${errText}`);
    }

    const transcript = await response.text();
    this.logger.log(`Transcribed ${transcript.length} characters`);
    return transcript.trim();
  }
}
