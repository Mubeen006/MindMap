import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly config: ConfigService) {}

  async embed(text: string): Promise<number[]> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');

    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama embedding failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    // nomic-embed-text returns a 768-dimension vector — must match schema.prisma vector(768)
    return data.embedding;
  }
}
