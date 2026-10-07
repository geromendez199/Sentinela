export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Prevent formulas from running when a seller opens the CSV in a spreadsheet.
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function makeCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function compareCells(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}
