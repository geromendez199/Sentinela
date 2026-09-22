import { adminClient } from '../_shared/db.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';

/**
 * Root-cause clustering (section 8.3).
 *
 * Deterministic agglomerative clustering over sanitized embeddings, per item,
 * with a minimum sample count. It produces suggestions for review: the MVP
 * never edits a listing automatically.
 */

const DISTANCE_THRESHOLD = 0.25;
const MIN_CLUSTER_SIZE = 3;
const RECENT_WINDOW_DAYS = 30;

interface DocumentRow {
  id: string;
  item_id: string | null;
  embedding: number[] | string | null;
  created_at: string;
  source_type: string;
}

function parseVector(value: number[] | string | null): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value) as number[];
  } catch {
    return null;
  }
}

function cosineDistance(a: number[], b: number[]): number {
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

function centroid(vectors: number[][]): number[] {
  const length = vectors[0]?.length ?? 0;
  const out = new Array<number>(length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + (vector[i] ?? 0);
  }
  return out.map((value) => value / Math.max(1, vectors.length));
}

async function clusterAccount(account: { id: string; org_id: string }): Promise<number> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const { data: documents } = await adminClient()
    .from('root_cause_documents')
    .select('id, item_id, embedding, created_at, source_type')
    .eq('meli_account_id', account.id)
    .gte('created_at', since)
    .not('embedding', 'is', null)
    .limit(2000);

  const byItem = new Map<string, DocumentRow[]>();
  for (const document of (documents ?? []) as DocumentRow[]) {
    if (!document.item_id) continue;
    const bucket = byItem.get(document.item_id) ?? [];
    bucket.push(document);
    byItem.set(document.item_id, bucket);
  }

  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 86_400_000;
  let created = 0;

  for (const [itemId, rows] of byItem) {
    if (rows.length < MIN_CLUSTER_SIZE) continue;

    const ordered = [...rows].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
    );

    const clusters: Array<{ members: DocumentRow[]; vectors: number[][]; centroid: number[] }> = [];

    for (const document of ordered) {
      const vector = parseVector(document.embedding);
      if (!vector) continue;

      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < clusters.length; i++) {
        const distance = cosineDistance(vector, clusters[i]!.centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0 && bestDistance <= DISTANCE_THRESHOLD) {
        const cluster = clusters[bestIndex]!;
        cluster.members.push(document);
        cluster.vectors.push(vector);
        cluster.centroid = centroid(cluster.vectors);
      } else {
        clusters.push({ members: [document], vectors: [vector], centroid: vector });
      }
    }

    for (const cluster of clusters) {
      if (cluster.members.length < MIN_CLUSTER_SIZE) continue;

      const recent = cluster.members.filter((m) => Date.parse(m.created_at) >= recentCutoff).length;
      const historical = cluster.members.length - recent;
      const trend = historical > 0 ? recent / historical : recent;

      const firstSeen = cluster.members[0]?.created_at ?? null;
      const lastSeen = cluster.members[cluster.members.length - 1]?.created_at ?? null;

      const { error } = await adminClient().from('root_cause_clusters').insert({
        org_id: account.org_id,
        meli_account_id: account.id,
        item_id: itemId,
        label: `patron-${cluster.members.length}-casos`,
        sample_count: cluster.members.length,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        trend_score: trend,
        status: 'active',
      });

      if (!error) created += 1;
    }
  }

  return created;
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const { data: accounts } = await adminClient()
    .from('meli_accounts')
    .select('id, org_id')
    .in('status', ['active', 'degraded']);

  let clusters = 0;
  for (const account of accounts ?? []) {
    try {
      clusters += await clusterAccount(account);
    } catch (error) {
      log('warn', 'root_cause_cluster_failed', { meli_account_id: account.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ clusters }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
