export type ListParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 25;
export function listQuery(params: ListParams, statuses: readonly string[], sorts: readonly string[] = ['newest', 'oldest']) {
  const first = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';
  const rawPage = Number(first(params.page));
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1,
    q: first(params.q).trim().slice(0, 120),
    status: statuses.includes(first(params.status)) ? first(params.status) : '',
    sort: sorts.includes(first(params.sort)) ? first(params.sort) : (sorts[0] ?? 'newest'),
    severity: ['critical', 'high', 'warning', 'info'].includes(first(params.severity)) ? first(params.severity) : '',
  };
}
export function numericSearch(value: string): number {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : -1;
}
export function literalSearch(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
