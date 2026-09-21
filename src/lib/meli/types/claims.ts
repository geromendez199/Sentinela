export interface MeliClaim {
  id: number | string;
  type?: string;
  stage?: string;
  status?: string;
  parent_id?: number | string | null;
  resource?: string;
  resource_id?: number | string;
  reason_id?: string | null;
  site_id?: string;
  date_created?: string;
  last_updated?: string;
  players?: Array<{ role?: string; type?: string; user_id?: number; available_actions?: string[] }>;
  related_entities?: string[];
}

export interface MeliClaimDetail extends MeliClaim {
  due_date?: string | null;
  action_responsible?: string | null;
  problem?: { code?: string; description?: string } | null;
  available_actions?: Array<{ action?: string; mandatory?: boolean; due_date?: string | null }>;
}

/** GET /post-purchase/v1/claims/{id}/affects-reputation */
export interface MeliClaimAffectsReputation {
  affects_reputation?: boolean;
  reason?: string | null;
  last_updated?: string | null;
}

export interface MeliClaimsSearchResponse {
  data: MeliClaim[];
  paging: { total: number; offset: number; limit: number };
}

export interface MeliClaimReason {
  id: string;
  name?: string;
  detail?: string;
  group?: string;
  last_updated?: string;
}
