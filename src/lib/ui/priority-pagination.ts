export function prioritySlices(counts: number[], offset: number, limit: number): Array<{ group: number; from: number; to: number }> {
  const slices: Array<{ group: number; from: number; to: number }> = [];
  let start = 0;
  counts.forEach((count, group) => {
    const from = Math.max(0, offset - start);
    const to = Math.min(count, offset + limit - start) - 1;
    if (from <= to && from < count) slices.push({ group, from, to });
    start += count;
  });
  return slices;
}
