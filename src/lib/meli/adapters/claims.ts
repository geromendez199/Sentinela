import type { MeliClaim, MeliClaimDetail } from '../types/claims';

export interface NormalizedClaim {
  claimId: string;
  orderId: number | null;
  packId: number | null;
  type: string | null;
  stage: string | null;
  status: string | null;
  reasonId: string | null;
  dateCreated: string | null;
  sourceLastUpdated: string | null;
  dueDate: string | null;
  actionResponsible: string | null;
  availableActions: string[];
  rawSanitized: Record<string, unknown>;
}

export function normalizeClaim(claim: MeliClaim | MeliClaimDetail): NormalizedClaim {
  const detail = claim as MeliClaimDetail;
  const resourceId = claim.resource_id === undefined ? null : Number(claim.resource_id);
  const isOrder = claim.resource === 'order' || claim.resource === undefined;

  return {
    claimId: String(claim.id),
    orderId: isOrder && Number.isFinite(resourceId) ? resourceId : null,
    packId: claim.resource === 'pack' && Number.isFinite(resourceId) ? resourceId : null,
    type: claim.type ?? null,
    stage: claim.stage ?? null,
    status: claim.status ?? null,
    reasonId: claim.reason_id ?? null,
    dateCreated: claim.date_created ?? null,
    sourceLastUpdated: claim.last_updated ?? null,
    dueDate: detail.due_date ?? null,
    actionResponsible: detail.action_responsible ?? null,
    availableActions: (detail.available_actions ?? [])
      .map((entry) => entry.action)
      .filter((action): action is string => typeof action === 'string'),
    rawSanitized: {
      stage: claim.stage ?? null,
      type: claim.type ?? null,
      problem_code: detail.problem?.code ?? null,
      related_entities: claim.related_entities ?? [],
    },
  };
}
