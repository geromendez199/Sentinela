import type { FeatureContribution } from './heuristic';

const LABELS: Record<string, string> = {
  sla_pressure: 'Tiempo de despacho contra el SLA oficial',
  shipment_exception: 'Excepcion o senal de demora en el envio',
  stock_gap: 'Diferencia entre stock publicado y operativo',
  sku_claim_rate_z: 'Historial de reclamos del SKU',
  item_claim_rate_z: 'Historial de reclamos de la publicacion',
  message_package_intent: 'El comprador pregunta donde esta el paquete',
  message_product_issue: 'El comprador reporta un problema del producto',
  urgency: 'Urgencia detectada en el texto',
  negative_sentiment: 'Sentimiento negativo del comprador',
  response_latency: 'Mensaje del comprador sin responder',
  capacity_pressure: 'Ordenes pendientes sobre capacidad horaria',
  account_headroom: 'Cercania de la cuenta al umbral de reputacion',
  pack_order_count: 'El pack multiplica las ordenes afectadas',
};

export interface Explanation {
  feature: string;
  label: string;
  value: number;
  contribution: number;
  direction: 'increases' | 'decreases';
}

/** Top contributions, stored with every score so a decision stays auditable. */
export function explain(contributions: FeatureContribution[], limit = 5): Explanation[] {
  return contributions
    .filter((entry) => Math.abs(entry.contribution) > 0.001)
    .slice(0, limit)
    .map((entry) => ({
      feature: entry.feature,
      label: LABELS[entry.feature] ?? entry.feature,
      value: entry.value,
      contribution: entry.contribution,
      direction: entry.contribution >= 0 ? 'increases' : 'decreases',
    }));
}
