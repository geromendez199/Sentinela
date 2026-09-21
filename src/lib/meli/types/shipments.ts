export interface MeliShipment {
  id: number;
  status?: string;
  substatus?: string | null;
  mode?: string;
  logistic_type?: string;
  service_id?: number | string | null;
  date_created?: string;
  last_updated?: string;
  status_history?: {
    date_ready_to_ship?: string | null;
    date_shipped?: string | null;
    date_delivered?: string | null;
    date_first_visit?: string | null;
    date_handling?: string | null;
  };
  pack_id?: number | null;
  order_id?: number | null;
}

/** GET /shipments/{id}/sla. estimated_handling_limit is deprecated: use expected_date. */
export interface MeliShipmentSla {
  status?: string;
  service?: string;
  expected_date?: string;
  last_updated?: string;
  offset?: { date?: string; shipping?: string };
}

export interface MeliShipmentDelay {
  delay_type?: string;
  shipment_id?: number;
  date_created?: string;
  status?: string;
}

export interface MeliShipmentHistoryEntry {
  status?: string;
  substatus?: string | null;
  date?: string;
  checkpoint?: string;
}
