export interface ListingHealthInput { title: string | null; status: string | null; availableQuantity: number | null; raw: unknown }
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
export function diagnoseListing(input: ListingHealthInput) {
  const raw = record(input.raw);
  const findings: Array<{ area: string; priority: 'high' | 'review'; message: string }> = [];
  const unknown: string[] = [];
  if (!input.title?.trim()) findings.push({ area: 'Título', priority: 'high', message: 'Revisá el título: no está informado en los datos sincronizados.' });
  if (input.status === 'under_review') findings.push({ area: 'Estado', priority: 'high', message: 'La publicación está en revisión. Consultá el motivo oficial en Mercado Libre.' });
  if (input.availableQuantity === 0 && input.status === 'active') findings.push({ area: 'Disponibilidad', priority: 'high', message: 'La publicación activa informa cero unidades. Verificá el modelo de stock antes de ofrecer disponibilidad.' });
  if (Array.isArray(raw?.pictures)) { if (!raw.pictures.length) findings.push({ area: 'Fotos', priority: 'review', message: 'No hay fotos en el recurso observado. Revisá imágenes del producto, empaque y medidas.' }); }
  else unknown.push('Fotos');
  if (Array.isArray(raw?.attributes)) {
    for (const value of raw.attributes) {
      const attribute = record(value);
      if (attribute && !attribute.value_name && !attribute.value_id && (!Array.isArray(attribute.values) || !attribute.values.length)) findings.push({ area: 'Atributos', priority: 'review', message: `Revisá el atributo ${String(attribute.name ?? attribute.id ?? 'sin valor')}.` });
    }
    if (!raw.attributes.length) findings.push({ area: 'Atributos', priority: 'review', message: 'No hay atributos en el recurso observado. Revisá los requisitos de la categoría.' });
  } else unknown.push('Atributos');
  return { findings, unknown, status: findings.some(finding => finding.priority === 'high') ? 'attention' : findings.length ? 'review' : unknown.length ? 'partial' : 'observed' };
}

/** Observed claim incidence in one account/item/window; not an official CX rating. */
export function calculateCx(orderIds: number[], claimOrderIds: Array<number | null>) {
  const sales = new Set(orderIds);
  const defects = new Set(claimOrderIds.filter((id): id is number => id !== null && sales.has(id)));
  const rate = sales.size ? defects.size / sales.size : null;
  return { sales: sales.size, affectedSales: defects.size, rate, health: rate === null ? 'unknown' : sales.size < 20 ? 'insufficient' : rate >= .1 ? 'critical' : rate >= .05 ? 'watch' : 'healthy' };
}
