import { cosineDistance } from './embeddings';

/**
 * Deterministic agglomerative clustering over sanitized issue embeddings
 * (section 8.3). Deterministic so the same evidence always produces the same
 * cluster, which is what makes a listing suggestion auditable.
 */
export interface IssueDocument {
  id: string;
  itemId: string | null;
  vector: number[];
  createdAt: string;
  intent: string | null;
}

export interface IssueCluster {
  representativeId: string;
  memberIds: string[];
  itemId: string | null;
  size: number;
  /** recent_rate / historical_baseline. > 1 means the pattern is growing. */
  trend: number;
  dominantIntent: string | null;
}

export interface ClusterOptions {
  distanceThreshold?: number;
  minClusterSize?: number;
  recentWindowDays?: number;
  now?: Date;
}

function centroid(vectors: number[][]): number[] {
  const length = vectors[0]?.length ?? 0;
  const output = new Array<number>(length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < length; i++) output[i] = (output[i] ?? 0) + (vector[i] ?? 0);
  }
  return output.map((value) => value / Math.max(1, vectors.length));
}

function dominant(values: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function clusterIssues(documents: IssueDocument[], options: ClusterOptions = {}): IssueCluster[] {
  const threshold = options.distanceThreshold ?? 0.25;
  const minSize = options.minClusterSize ?? 3;
  const recentDays = options.recentWindowDays ?? 30;
  const now = options.now ?? new Date();

  const clusters: Array<{ members: IssueDocument[]; centroid: number[] }> = [];

  // Deterministic order: oldest first, id as tiebreaker.
  const ordered = [...documents].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
  );

  for (const document of ordered) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (!cluster) continue;
      const distance = cosineDistance(document.vector, cluster.centroid);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    const target = bestIndex >= 0 ? clusters[bestIndex] : undefined;
    if (target && bestDistance <= threshold) {
      target.members.push(document);
      target.centroid = centroid(target.members.map((member) => member.vector));
    } else {
      clusters.push({ members: [document], centroid: document.vector });
    }
  }

  const recentCutoff = now.getTime() - recentDays * 86_400_000;

  return clusters
    .filter((cluster) => cluster.members.length >= minSize)
    .map((cluster) => {
      const recent = cluster.members.filter((m) => Date.parse(m.createdAt) >= recentCutoff).length;
      const historical = cluster.members.length - recent;
      const representative = cluster.members
        .map((member) => ({ member, distance: cosineDistance(member.vector, cluster.centroid) }))
        .sort((a, b) => a.distance - b.distance)[0]?.member;

      return {
        representativeId: representative?.id ?? cluster.members[0]?.id ?? '',
        memberIds: cluster.members.map((member) => member.id),
        itemId: dominant(cluster.members.map((member) => member.itemId)),
        size: cluster.members.length,
        trend: historical > 0 ? recent / historical : recent > 0 ? Number.POSITIVE_INFINITY : 0,
        dominantIntent: dominant(cluster.members.map((member) => member.intent)),
      };
    })
    .sort((a, b) => b.size - a.size);
}

/** Maps a clustered pattern to a listing suggestion. Never auto-applied (section 8.3). */
export type SuggestionType = 'title' | 'attributes' | 'photos' | 'description' | 'size_guide' | 'stock' | 'other';

export function suggestionForCluster(cluster: IssueCluster): { type: SuggestionType; rationale: string } | null {
  switch (cluster.dominantIntent) {
    case 'wrong_variant':
      return {
        type: 'size_guide',
        rationale: 'Patron recurrente de variante/talle incorrecto: revisar guia de talles, medidas visibles y atributo de fit.',
      };
    case 'product_different':
      return {
        type: 'photos',
        rationale: 'Diferencias de color/modelo reportadas: mejorar fotos por variante, nombre de color y aclaracion de iluminacion.',
      };
    case 'missing_parts':
      return {
        type: 'description',
        rationale: 'Faltantes concentrados en el SKU: explicitar contenido de la caja con foto y revisar el SOP de packing.',
      };
    case 'product_defective':
      return {
        type: 'other',
        rationale: 'Fallas repetidas: auditar lote/proveedor y considerar pausa preventiva mediante action draft.',
      };
    case 'usage_question':
      return {
        type: 'attributes',
        rationale: 'Confusion pre-venta recurrente: completar atributos, titulo y FAQ visual para evitar compras equivocadas.',
      };
    default:
      return null;
  }
}
