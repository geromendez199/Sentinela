import { describe, expect, it } from 'vitest';
import { csvCell, makeCsv, compareCells } from '@/lib/ui/table-data';

describe('table exports', () => {
  it('preserves commas, quotes and line breaks', () => expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
  it.each(['=SUM(A1)', '+1', '-1+1', '@SUM(A1)', ' \t=1'])('neutralizes spreadsheet formulas: %s', (value) => expect(csvCell(value)).toBe('"\'' + value + '"'));
  it('exports every column with UTF-8 BOM', () => expect(makeCsv(['ID','Título'],[['123','Remera']])).toBe('\uFEFF"ID","Título"\r\n"123","Remera"'));
  it('sorts numeric cells numerically and Spanish labels naturally', () => { expect(compareCells(2,10)).toBeLessThan(0); expect(compareCells('Orden 2','Orden 10')).toBeLessThan(0); });
});
