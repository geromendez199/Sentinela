import { describe, expect, it } from 'vitest';
import { clusterIssues, suggestionForCluster, type IssueDocument } from '@/lib/ai/root-cause';
import { cosineDistance } from '@/lib/ai/embeddings';

function vector(seed: number, noise = 0): number[] {
  return Array.from({ length: 8 }, (_, index) => Math.sin(seed + index) + noise * Math.cos(index));
}

function document(id: string, seed: number, intent: string, daysAgo: number): IssueDocument {
  return {
    id,
    itemId: 'MLA123',
    vector: vector(seed),
    intent,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

describe('issue clustering', () => {
  it('groups near-identical issues and drops singletons', () => {
    const clusters = clusterIssues(
      [
        document('a', 1, 'wrong_variant', 5),
        document('b', 1.001, 'wrong_variant', 4),
        document('c', 1.002, 'wrong_variant', 3),
        document('z', 40, 'billing', 2),
      ],
      { minClusterSize: 3 },
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.memberIds).toHaveLength(3);
    expect(clusters[0]?.dominantIntent).toBe('wrong_variant');
  });

  it('is deterministic for the same evidence', () => {
    const documents = [
      document('a', 1, 'missing_parts', 10),
      document('b', 1.001, 'missing_parts', 9),
      document('c', 1.002, 'missing_parts', 8),
    ];
    expect(clusterIssues(documents)).toEqual(clusterIssues([...documents].reverse()));
  });

  it('reports a rising trend when cases concentrate recently', () => {
    const clusters = clusterIssues([
      document('old', 1, 'product_defective', 80),
      document('a', 1.001, 'product_defective', 5),
      document('b', 1.002, 'product_defective', 4),
      document('c', 1.003, 'product_defective', 3),
    ]);
    expect(clusters[0]?.trend).toBeGreaterThan(1);
  });

  it('maps a pattern to a suggestion type the schema accepts', () => {
    const suggestion = suggestionForCluster({
      representativeId: 'a',
      memberIds: ['a', 'b', 'c'],
      itemId: 'MLA123',
      size: 3,
      trend: 2,
      dominantIntent: 'wrong_variant',
    });
    expect(suggestion?.type).toBe('size_guide');
  });
});

describe('cosine distance', () => {
  it('is zero for identical vectors and one for orthogonal ones', () => {
    expect(cosineDistance([1, 0], [1, 0])).toBeCloseTo(0);
    expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1);
  });

  it('never divides by zero', () => {
    expect(cosineDistance([0, 0], [1, 1])).toBe(1);
  });
});
