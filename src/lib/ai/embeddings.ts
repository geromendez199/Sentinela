import 'server-only';
import { getAiProvider } from './provider';
import { neutralizeInjection } from './prompt-security';
import { redactPii } from './redact-pii';

/** Baseline dimension. Changing it requires a new column/migration, never a mix. */
export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  vector: number[];
  sanitizedText: string;
}

export async function embedIssueText(text: string): Promise<EmbeddingResult> {
  const provider = getAiProvider();
  const sanitized = neutralizeInjection(redactPii(text).text).text;
  const [vector] = await provider.embed([sanitized]);

  if (!vector) throw new Error('embedding_missing');
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`embedding_dimension_mismatch:${vector.length}`);
  }

  return { vector, sanitizedText: sanitized };
}

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
