import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { listQuery, literalSearch, numericSearch } from '@/lib/ui/list-query';
import { progressPercent, syncHealth } from '@/lib/accounts/sync-health';

describe('safe session redirects', () => {
 it.each(['https://other.example', '//other.example', '/\\other.example', '/\n/other.example', 'javascript:alert(1)'])('rejects %s', value => expect(safeRedirectPath(value)).toBe('/'));
 it('preserves an internal return path', () => expect(safeRedirectPath('/team/orders?page=2')).toBe('/team/orders?page=2'));
});
describe('data list input', () => {
 it('bounds pages, query length and status', () => expect(listQuery({page:'Infinity', q:' x'.repeat(150), status:'closed'},['open'])).toEqual({page:1,q:' x'.repeat(150).trim().slice(0,120),status:''}));
 it('accepts valid pagination and status', () => expect(listQuery({page:'3',status:'open'},['open'])).toEqual({page:3,status:'open',q:''}));
 it.each(['1.5','-1','1e3','9007199254740993','1),status.eq.open'])('rejects invalid numeric IDs: %s', value=>expect(numericSearch(value)).toBe(-1));
 it('accepts an exact numeric ID',()=>expect(numericSearch('123456789')).toBe(123456789));
 it('treats search wildcards literally',()=>expect(literalSearch('50%_\\')).toBe('50\\%\\_\\\\'));
});
describe('truthful synchronization status', () => {
 const now=Date.parse('2026-10-06T19:00:00Z');
 const job=(status:string, age=0)=>({status,progress:0,updated_at:new Date(now-age).toISOString()});
 it('never reports queued work as running',()=>expect(syncHealth([job('queued')],now).label).toBe('Esperando sincronización'));
 it('identifies paused work',()=>expect(syncHealth([job('paused')],now).label).toBe('Carga pausada'));
 it('distinguishes stale execution',()=>expect(syncHealth([job('running',30*60*1000)],now).label).toBe('Sin avance reciente'));
 it('reports recent execution',()=>expect(syncHealth([job('running')],now).label).toBe('Carga en curso'));
 it('does not hide a failure behind completed work',()=>expect(syncHealth([job('done'),job('failed')],now).label).toBe('Necesita revisión'));
 it('reports complete only when all shown jobs finished',()=>expect(syncHealth([job('done')],now).label).toBe('Carga completada'));
 it('handles invalid progress safely',()=>expect([progressPercent(null),progressPercent(NaN),progressPercent(-1),progressPercent(2)]).toEqual([0,0,0,100]));
});
