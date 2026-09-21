import 'server-only';
import { logger } from '@/lib/observability/logger';
import {
  CLASSIFICATION_SCHEMA_VERSION,
  classificationSchema,
  type Classification,
} from './classification-schema';
import { getAiProvider } from './provider';
import { buildClassifierInput, CLASSIFIER_SYSTEM_PROMPT, neutralizeInjection } from './prompt-security';
import { contentHash, redactPii } from './redact-pii';

export interface ClassifyRequest {
  text: string;
  siteId: string;
  source: 'message' | 'question' | 'claim';
}

export interface ClassifyResult {
  classification: Classification;
  contentHash: string;
  schemaVersion: string;
  model: string;
  injectionSuspected: boolean;
  redactionCounts: Record<string, number>;
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('ai_response_not_json');
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Classifies one piece of buyer text. The caller is responsible for skipping
 * work when `contentHash` already exists for the same schema and model.
 */
export async function classifyText(request: ClassifyRequest): Promise<ClassifyResult> {
  const provider = getAiProvider();
  const redacted = redactPii(request.text);
  const guarded = neutralizeInjection(redacted.text);

  const hash = await contentHash(guarded.text, CLASSIFICATION_SCHEMA_VERSION, provider.classifierModel);

  const raw = await provider.complete({
    system: CLASSIFIER_SYSTEM_PROMPT,
    input: buildClassifierInput({
      siteId: request.siteId,
      source: request.source,
      sanitizedText: guarded.text,
    }),
    maxTokens: 400,
    temperature: 0,
  });

  const classification = classificationSchema.parse(extractJson(raw));

  if (guarded.injectionSuspected) {
    logger.warn('prompt_injection_suspected', { event: 'classify_text', source: request.source });
  }

  return {
    classification,
    contentHash: hash,
    schemaVersion: CLASSIFICATION_SCHEMA_VERSION,
    model: provider.classifierModel,
    injectionSuspected: guarded.injectionSuspected,
    redactionCounts: redacted.counts,
  };
}
