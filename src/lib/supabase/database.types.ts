/**
 * Hand-maintained mirror of the columns Sentinela reads from the browser and
 * from server components. Regenerate with:
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * Keep the migrations in supabase/migrations as the source of truth; this file
 * only narrows what the application layer is allowed to touch.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Row shapes are type aliases, not interfaces: an interface has no implicit
 * index signature, so it does not satisfy postgrest-js's GenericTable
 * constraint and every select() would infer as `never`.
 */

export type OrgRole = 'owner' | 'admin' | 'operator' | 'viewer';

export type MeliAccountStatus =
  | 'onboarding'
  | 'backfilling'
  | 'active'
  | 'degraded'
  | 'reconnect_required'
  | 'restricted'
  | 'disconnected';

export type ActionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'blocked_policy'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type FidelityStatus = 'initializing' | 'calibrated' | 'degraded' | 'unknown';

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMemberRow = {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  updated_at: string;
};

export type MeliAccountRow = {
  id: string;
  org_id: string;
  seller_id: number;
  nickname: string | null;
  site_id: string;
  status: MeliAccountStatus;
  status_reason: string | null;
  power_seller_status: string | null;
  level_id: string | null;
  linked_at: string;
  last_api_ok_at: string | null;
  last_reputation_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReputationSnapshotRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  observed_at: string;
  level_id: string | null;
  power_seller_status: string | null;
  claims_rate: number | null;
  claims_value: number | null;
  claims_period: string | null;
  cancellations_rate: number | null;
  cancellations_value: number | null;
  cancellations_period: string | null;
  delay_rate: number | null;
  delay_value: number | null;
  delay_period: string | null;
  sales_completed: number | null;
  sales_period: string | null;
  raw_sanitized: Json;
};

export type ReputationComputationRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  computed_at: string;
  rule_set_id: string | null;
  window_start: string | null;
  window_end: string | null;
  claims_value: number | null;
  claims_denominator: number | null;
  claims_rate: number | null;
  cancellations_value: number | null;
  cancellations_denominator: number | null;
  cancellations_rate: number | null;
  delay_value: number | null;
  delay_denominator: number | null;
  delay_rate: number | null;
  headroom: Json;
  projections: Json;
  drift: Json;
  fidelity: FidelityStatus;
};

export type RiskScoreRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  order_id: number | null;
  pack_id: number | null;
  computed_at: string;
  model_version_id: string;
  risk_probability: number;
  claim_risk: number | null;
  cancellation_risk: number | null;
  delay_risk: number | null;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  explanations: Json;
  feature_hash: string;
  expires_at: string | null;
};

export type ActionDraftRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  kind: string;
  status: ActionStatus;
  requires_approval: boolean;
  payload_sanitized: Json;
  rendered_text: string | null;
  policy_snapshot: Json;
  idempotency_key: string;
  order_id: number | null;
  pack_id: number | null;
  claim_id: number | null;
  item_id: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  external_result: Json;
  error_code: string | null;
  error_message: string | null;
};

export type AlertRow = {
  id: string;
  org_id: string;
  meli_account_id: string | null;
  severity: 'info' | 'warning' | 'high' | 'critical';
  kind: string;
  title: string;
  body: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

export type OrderRow = {
  org_id: string;
  meli_account_id: string;
  order_id: number;
  pack_id: number | null;
  shipment_id: number | null;
  status: string;
  tags: string[];
  date_created: string;
  date_closed: string | null;
  source_last_updated: string;
  total_amount: number | null;
  currency_id: string | null;
  buyer_pseudonym: string | null;
};

export type ClaimRow = {
  org_id: string;
  meli_account_id: string;
  claim_id: number;
  order_id: number | null;
  pack_id: number | null;
  type: string | null;
  stage: string | null;
  status: string | null;
  reason_id: string | null;
  affects_reputation: 'affected' | 'not_affected' | 'not_applies' | null;
  action_responsible: string | null;
  available_actions: string[];
  date_created: string | null;
  due_date: string | null;
  source_last_updated: string;
};

export type ItemRow = {
  org_id: string;
  meli_account_id: string;
  item_id: string;
  title: string | null;
  status: string | null;
  category_id: string | null;
  available_quantity: number | null;
  logistic_types: string[];
  health: number | null;
  source_last_updated: string | null;
};

export type ListingSuggestionRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  item_id: string;
  cluster_id: string | null;
  suggestion_type: string;
  rationale: string;
  proposed_change: Json;
  evidence_count: number;
  status: 'new' | 'accepted' | 'rejected' | 'applied' | 'dismissed';
  created_at: string;
};

export type RootCauseClusterRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  item_id: string;
  label: string;
  sample_count: number;
  trend_score: number | null;
  status: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  updated_at: string;
};

/**
 * Write access is decided by RLS and by the backend routes, not by these types:
 * the browser has no write policy on the MercadoLibre mirrors, on risk, on
 * reputation or on action execution. The shapes stay uniform so the generated
 * client keeps inferring select() results correctly.
 */

export type SyncJobRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  kind: string;
  resource_kind: string | null;
  status: 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  priority: number;
  range_start: string | null;
  range_end: string | null;
  cursor: Json;
  progress: number;
  processed_count: number;
  estimated_total: number | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ReputationIncidentRow = {
  id: string;
  org_id: string;
  meli_account_id: string;
  order_id: number | null;
  claim_id: number | null;
  shipment_id: number | null;
  incident_type: 'claim' | 'cancellation' | 'delay' | 'mediation';
  occurred_at: string;
  affects_reputation: boolean | null;
  affect_source: string;
  exclusion_reason: string | null;
  projected_expiry_at: string | null;
  last_evaluated_at: string;
  source_key: string;
};

export type PlaybookRuleRow = {
  id: string;
  org_id: string;
  meli_account_id: string | null;
  name: string;
  enabled: boolean;
  trigger_kind: string;
  conditions: Json;
  actions: Json;
  requires_approval: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RetentionPolicyRow = {
  org_id: string;
  entity: string;
  retention_days: number;
  legal_hold: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type DataSubjectRequestRow = {
  id: string;
  org_id: string;
  request_type: 'access' | 'rectification' | 'deletion' | 'restriction' | 'other';
  subject_reference_hash: string;
  status: string;
  received_at: string;
  due_at: string | null;
  resolved_at: string | null;
  notes: string | null;
};

export type SecurityAuditLogRow = {
  id: number;
  org_id: string | null;
  actor_user_id: string | null;
  meli_account_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  correlation_id: string | null;
  metadata: Json;
  created_at: string;
};

export type ShipmentRow = {
  org_id: string;
  meli_account_id: string;
  shipment_id: number;
  pack_id: number | null;
  status: string | null;
  substatus: string | null;
  mode: string | null;
  logistic_type: string | null;
  expected_dispatch_at: string | null;
  sla_status: string | null;
  sla_service: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  source_last_updated: string | null;
};

export type MessageRow = {
  org_id: string;
  meli_account_id: string;
  message_id: string;
  pack_id: number | null;
  order_id: number | null;
  actor_role: 'buyer' | 'seller' | 'meli_agent' | 'system' | 'unknown';
  text_sanitized: string | null;
  date_created: string;
  classification_id: string | null;
};

export type InternalMetricRow = {
  id: number;
  org_id: string | null;
  meli_account_id: string | null;
  name: string;
  value: number;
  labels: Json;
  recorded_at: string;
};

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      organizations: Table<OrganizationRow>;
      organization_members: Table<OrganizationMemberRow>;
      meli_accounts: Table<MeliAccountRow>;
      reputation_snapshots: Table<ReputationSnapshotRow>;
      reputation_computations: Table<ReputationComputationRow>;
      risk_scores: Table<RiskScoreRow>;
      action_drafts: Table<ActionDraftRow>;
      alerts: Table<AlertRow>;
      orders: Table<OrderRow>;
      claims: Table<ClaimRow>;
      items: Table<ItemRow>;
      listing_suggestions: Table<ListingSuggestionRow>;
      root_cause_clusters: Table<RootCauseClusterRow>;
      sync_jobs: Table<SyncJobRow>;
      reputation_incidents: Table<ReputationIncidentRow>;
      playbook_rules: Table<PlaybookRuleRow>;
      retention_policies: Table<RetentionPolicyRow>;
      data_subject_requests: Table<DataSubjectRequestRow>;
      security_audit_log: Table<SecurityAuditLogRow>;
      shipments: Table<ShipmentRow>;
      messages: Table<MessageRow>;
      internal_metrics: Table<InternalMetricRow>;
    };
    Views: {
      latest_reputation: {
        Row: Pick<
          ReputationSnapshotRow,
          | 'org_id'
          | 'meli_account_id'
          | 'observed_at'
          | 'level_id'
          | 'power_seller_status'
          | 'claims_rate'
          | 'cancellations_rate'
          | 'delay_rate'
          | 'sales_completed'
        >;
        Relationships: [];
      };
      latest_risk_per_order: { Row: RiskScoreRow; Relationships: [] };
      open_operational_risk: {
        Row: RiskScoreRow & { status: string; date_created: string };
        Relationships: [];
      };
    };
    Functions: {
      create_organization: { Args: { p_name: string; p_slug: string }; Returns: string };
      is_org_member: { Args: { p_org_id: string }; Returns: boolean };
      org_role_for: { Args: { p_org_id: string }; Returns: OrgRole };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      org_role: OrgRole;
      meli_account_status: MeliAccountStatus;
      action_status: ActionStatus;
      fidelity_status: FidelityStatus;
    };
  };
}
