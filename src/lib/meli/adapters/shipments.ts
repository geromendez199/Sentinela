import type { MeliShipment, MeliShipmentSla } from '../types/shipments';

export interface NormalizedShipment {
  shipmentId: number;
  packId: number | null;
  status: string | null;
  substatus: string | null;
  mode: string | null;
  logisticType: string | null;
  serviceId: string | null;
  dateCreated: string | null;
  sourceLastUpdated: string | null;
  readyToShipAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  rawSanitized: Record<string, unknown>;
}

export function normalizeShipment(shipment: MeliShipment): NormalizedShipment {
  return {
    shipmentId: shipment.id,
    packId: shipment.pack_id ?? null,
    status: shipment.status ?? null,
    substatus: shipment.substatus ?? null,
    mode: shipment.mode ?? null,
    logisticType: shipment.logistic_type ?? null,
    serviceId: shipment.service_id === undefined || shipment.service_id === null ? null : String(shipment.service_id),
    dateCreated: shipment.date_created ?? null,
    sourceLastUpdated: shipment.last_updated ?? null,
    readyToShipAt: shipment.status_history?.date_ready_to_ship ?? null,
    shippedAt: shipment.status_history?.date_shipped ?? null,
    deliveredAt: shipment.status_history?.date_delivered ?? null,
    rawSanitized: {
      mode: shipment.mode ?? null,
      logistic_type: shipment.logistic_type ?? null,
      substatus: shipment.substatus ?? null,
    },
  };
}

export interface NormalizedSla {
  expectedDispatchAt: string | null;
  slaStatus: string | null;
  slaService: string | null;
  slaLastUpdated: string | null;
}

/**
 * Rule 14: use the SLA resource as given. estimated_handling_limit is
 * deprecated and Sentinela must not rebuild a holiday/business-hours calendar.
 */
export function normalizeSla(sla: MeliShipmentSla): NormalizedSla {
  return {
    expectedDispatchAt: sla.expected_date ?? null,
    slaStatus: sla.status ?? null,
    slaService: sla.service ?? null,
    slaLastUpdated: sla.last_updated ?? null,
  };
}

/** Handling time for the delayed_handling_time metric: ready_to_ship -> shipped. */
export function handlingMinutes(shipment: NormalizedShipment): number | null {
  if (!shipment.readyToShipAt || !shipment.shippedAt) return null;
  const start = Date.parse(shipment.readyToShipAt);
  const end = Date.parse(shipment.shippedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 60_000);
}
