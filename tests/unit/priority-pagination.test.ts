import { describe, expect, it } from 'vitest';
import { prioritySlices } from '@/lib/ui/priority-pagination';
describe('priority pagination', () => {
  it('fills a page across severity boundaries', () => expect(prioritySlices([3,8,15,2], 5, 10)).toEqual([{group:1,from:2,to:7},{group:2,from:0,to:3}]));
  it('skips empty groups', () => expect(prioritySlices([0,0,4,0],0,25)).toEqual([{group:2,from:0,to:3}]));
  it('does not repeat records on adjacent pages', () => { expect(prioritySlices([30,30],0,25)).toEqual([{group:0,from:0,to:24}]); expect(prioritySlices([30,30],25,25)).toEqual([{group:0,from:25,to:29},{group:1,from:0,to:19}]); });
  it('returns no records beyond the result set', () => expect(prioritySlices([3,4],50,25)).toEqual([]));
});
