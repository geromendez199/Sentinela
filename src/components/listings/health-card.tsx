import { diagnoseListing, type ListingHealthInput } from '@/lib/listings/health';

export function ListingHealthCard({input}:{input:ListingHealthInput}) {
  const report=diagnoseListing(input);
  return <section className="card p-5 sm:p-6"><h2 className="text-sm font-semibold">Diagnóstico de publicación</h2><p className="muted mt-2 text-xs leading-relaxed">Revisión local del recurso sincronizado. No es una sanción ni el listado oficial de requisitos de la categoría.</p><ul className="mt-4 space-y-3">{report.findings.map((finding,index)=><li key={index} className="rounded-xl border p-4"><p className="text-xs font-semibold">{finding.area} · {finding.priority==='high'?'Prioridad alta':'Revisar'}</p><p className="muted mt-2 text-xs leading-relaxed">{finding.message}</p></li>)}{!report.findings.length&&<li className="rounded-xl bg-neutral-50 p-4 text-xs">No se detectaron señales en los campos disponibles.</li>}</ul>{report.unknown.length>0&&<p className="muted mt-4 text-xs">Sin información suficiente: {report.unknown.join(', ')}. Estos campos no se consideran completos automáticamente.</p>}</section>;
}
