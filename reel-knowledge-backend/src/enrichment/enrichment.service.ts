import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CategoryTreeService } from './category-tree.service';

export interface SetupStepInput {
  step: string;
  link: string | null;
}

export interface EnrichmentCard {
  title: string;
  problem_solved: string;
  key_points: string[];
  tools_mentioned: string[];
  setup_steps: SetupStepInput[];
  prerequisites: string[];
  transcript_formatted: string;
  category_parent: string;
  category_child: string | null;
  tags: string[];
}

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly categoryTree: CategoryTreeService,
  ) {}

  async enrichReel(transcript: string, caption: string): Promise<EnrichmentCard> {
    const treeText = await this.categoryTree.formatTreeForPrompt();
    const systemPrompt = this.buildSystemPrompt(treeText);
    const userContent = `Caption: ${caption}\n\nTranscript: ${transcript}`;
    const card = await this.callGroq(systemPrompt, userContent);

    if (card.tools_mentioned.length > 0 && !card.category_child) {
      card.category_child = card.tools_mentioned[0];
    }

    return card;
  }

  private buildSystemPrompt(treeText: string): string {
    return `You are extracting structured knowledge from a saved Instagram reel's transcript, for
someone who wants to recall what the reel taught them WITHOUT rewatching it.

Existing category tree (parent categories with their subcategories indented):
${treeText}

Return ONLY valid JSON (no markdown fences, no extra text) in this exact shape:
{
  "title": "max 10 words, must name the specific tool/technique, never generic phrasing",
  "problem_solved": "one sentence describing the real situation/need this reel addresses",
  "key_points": ["3 to 5 specific, actionable takeaways — each must include a concrete detail"],
  "tools_mentioned": ["specific tool or model names mentioned, e.g. Claude, Cursor — empty array if none"],
  "setup_steps": [{"step": "specific instruction", "link": "URL if one was given, else null"}],
  "prerequisites": ["things the viewer needs to know or have before this applies — empty array if none"],
  "transcript_formatted": "the FULL transcript reflowed into natural paragraphs separated by a blank line, with the 3 to 6 most important phrases wrapped in **double asterisks**. Do not shorten or summarize it — reformat only.",
  "category_parent": "an existing top-level category name from the tree above if one fits well, otherwise a new short top-level category name",
  "category_child": "an existing subcategory name under that parent if one fits, otherwise a new specific subcategory name, otherwise null if this reel is too broad to belong to a subcategory",
  "tags": ["3 to 6 lowercase tags, specific to THIS reel's actual content"]
}

CRITICAL RULES FOR key_points AND title:
- BAD (vague, do not do this): "Build AI agents with no-code canvas", "Scale agents for long-term use"
- GOOD (specific, do this): "Drag-and-drop canvas builds an agent in under 60 seconds without code",
  "Agents keep full context across long sessions without manual memory management"
- Every key point must answer "so what, specifically?" — a name, number, concrete mechanism, or
  exact step. If you can't make a point specific, cut it rather than keep it vague.
- The title must let someone recognize instantly what this reel is about from the title alone.

CRITICAL RULES FOR CATEGORIZATION:
- Prefer reusing an existing parent/child pair over creating a near-duplicate.
- Always try to find or create a SPECIFIC subcategory (category_child) rather than leaving the
  reel at the broad parent level only — broad-only placement should be rare, reserved for reels
  that are genuinely general (e.g. general life advice with no specific tool/technique).
- Do not force every reel into one existing category just because it's the closest broad match —
  if the tree doesn't have a good fit, create a new, precise parent and/or child.
- Only reuse an existing category if it is a PRECISE match for this reel's actual content — not
  just the closest broad option available. Reusing a broad category "because it's already there"
  is wrong. If nothing in the tree is a precise fit, create a new, specific one.
- If tools_mentioned is non-empty, category_child MUST NOT be null. Use an existing subcategory
  that names that tool/technique if one exists, otherwise create a new subcategory named after the
  primary tool (e.g. "Claude", "Cursor") under the most fitting parent.

CRITICAL RULES FOR tools_mentioned / setup_steps / prerequisites:
- Only populate these when the reel is actually about a specific tool, model, or setup process.
- If the reel is not tool/setup related, return empty arrays for all three — do not force content
  into them.

Return ONLY the JSON object.`;
  }

  private async callGroq(systemPrompt: string, userContent: string): Promise<EnrichmentCard> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');

    const model = this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq enrichment failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;

    try {
      return this.validateCard(JSON.parse(rawContent));
    } catch (e) {
      this.logger.error(`Failed to parse Groq JSON response: ${rawContent}`);
      throw new Error('Enrichment returned invalid JSON');
    }
  }

  private validateCard(parsed: any): EnrichmentCard {
    return {
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : 'Untitled',
      problem_solved: typeof parsed.problem_solved === 'string' ? parsed.problem_solved : '',
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 5) : [],
      tools_mentioned: Array.isArray(parsed.tools_mentioned) ? parsed.tools_mentioned.slice(0, 8) : [],
      setup_steps: Array.isArray(parsed.setup_steps)
        ? parsed.setup_steps
            .filter((s: any) => typeof s?.step === 'string')
            .slice(0, 10)
            .map((s: any) => ({ step: s.step, link: typeof s.link === 'string' ? s.link : null }))
        : [],
      prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites.slice(0, 6) : [],
      transcript_formatted:
        typeof parsed.transcript_formatted === 'string' ? parsed.transcript_formatted : '',
      category_parent:
        typeof parsed.category_parent === 'string' ? parsed.category_parent : 'Uncategorized',
      category_child: typeof parsed.category_child === 'string' ? parsed.category_child : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    };
  }
}
