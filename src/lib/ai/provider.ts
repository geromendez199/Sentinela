import 'server-only';
import { serverEnv } from '@/lib/env/server';
import { RetryableError } from '@/lib/meli/errors';

/**
 * Single abstracted LLM/embeddings provider (section 0.2). Swapping providers
 * must not require touching the classifier, the RCA job or any worker.
 */
export interface CompletionRequest {
  system: string;
  input: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
}

export interface AiProvider {
  readonly name: string;
  readonly classifierModel: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  complete(request: CompletionRequest): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    readonly classifierModel: string,
    readonly embeddingModel: string,
    readonly embeddingDimensions: number,
  ) {}

  async complete(request: CompletionRequest): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.classifierModel,
        max_tokens: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0,
        system: request.system,
        messages: [{ role: 'user', content: request.input }],
      }),
    });

    if (response.status === 429 || response.status >= 500) {
      throw new RetryableError('ai_provider_unavailable');
    }
    if (!response.ok) throw new Error(`ai_provider_error:${response.status}`);

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }

  async embed(_texts: string[]): Promise<number[][]> {
    // The embedding provider is configured separately; wire it before enabling
    // root-cause clustering. Dimensions must match the vector(1536) column.
    throw new Error('embeddings_provider_not_configured');
  }
}

class NullProvider implements AiProvider {
  readonly name = 'none';
  readonly classifierModel = 'none';
  readonly embeddingModel = 'none';
  readonly embeddingDimensions = 1536;

  async complete(): Promise<string> {
    throw new Error('ai_provider_disabled');
  }

  async embed(): Promise<number[][]> {
    throw new Error('ai_provider_disabled');
  }
}

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = serverEnv();

  if (env.AI_PROVIDER === 'anthropic' && env.AI_API_KEY) {
    cached = new AnthropicProvider(
      env.AI_API_KEY,
      env.AI_CLASSIFIER_MODEL ?? 'claude-haiku-4-5-20251001',
      env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      env.AI_EMBEDDING_DIMENSIONS,
    );
  } else {
    cached = new NullProvider();
  }

  return cached;
}
