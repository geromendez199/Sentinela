-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- claims / returns ----------
create table public.claim_reasons (
  reason_id text primary key,
  flow text,
  name text,
  detail text,
  site_ids text[] not null default '{}'::text[],
  groups text[] not null default '{}'::text[],
  allowed_flows text[] not null default '{}'::text[],
  expected_resolutions text[] not null default '{}'::text[],
  triage_tags text[] not null default '{}'::text[],
  status text,
  source_last_updated timestamptz,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now()
);
create table public.claims (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  claim_id bigint not null,
  resource text,
  resource_id bigint,
  order_id bigint,
  pack_id bigint,
  type text,
  stage text,
  status text,
  reason_id text references public.claim_reasons(reason_id),
  fulfilled boolean,
  affects_reputation text check (affects_reputation in ('affected','not_affected','not_applies') or affects_reputation is null),
  has_incentive boolean,
  due_date timestamptz,
  action_responsible text,
  problem_sanitized text,
  resolution_reason text,
  resolution_closed_by text,
  available_actions text[] not null default '{}'::text[],
  date_created timestamptz,
  source_last_updated timestamptz not null,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, claim_id)
);
create index claims_account_created_idx on public.claims(meli_account_id, date_created desc);
create index claims_open_idx on public.claims(meli_account_id, status, due_date) where status <> 'closed';
create index claims_order_idx on public.claims(meli_account_id, order_id) where order_id is not null;
create index claims_reason_idx on public.claims(meli_account_id, reason_id, date_created desc);
create table public.claim_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  claim_id bigint not null,
  external_message_id text not null,
  sender_role text,
  text_sanitized text,
  date_created timestamptz,
  moderation_status text,
  classification_id uuid,
  unique (meli_account_id, claim_id, external_message_id)
);
create table public.returns (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  claim_id bigint not null,
  return_id bigint not null,
  status text,
  type text,
  shipment jsonb not null default '{}'::jsonb,
  source_last_updated timestamptz,
  raw_sanitized jsonb not null default '{}'::jsonb,
  primary key (meli_account_id, return_id)
);
-- ---------- reputation ----------
create table public.reputation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  version text not null,
  effective_from date not null,
  effective_to date,
  high_volume_window_days integer,
  low_volume_window_days integer not null default 365,
  high_volume_min_sales integer,
  thresholds jsonb not null,
  comparators jsonb not null default '{}'::jsonb,
  source_url text not null,
  verification_status text not null check (verification_status in ('verified','conflict','unverified')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);
create index reputation_rule_site_date_idx on public.reputation_rule_sets(site_id, effective_from desc);
create table public.reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  observed_at timestamptz not null default now(),
  level_id text,
  power_seller_status text,
  real_level text,
  protection_end_date timestamptz,
  sales_period text,
  sales_completed integer,
  claims_period text,
  claims_value integer,
  claims_rate numeric(10,8),
  cancellations_period text,
  cancellations_value integer,
  cancellations_rate numeric(10,8),
  delay_period text,
  delay_value integer,
  delay_rate numeric(10,8),
  excluded jsonb not null default '{}'::jsonb,
  raw_sanitized jsonb not null default '{}'::jsonb
);
create index reputation_snapshots_account_time_idx on public.reputation_snapshots(meli_account_id, observed_at desc);
create table public.reputation_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  order_id bigint,
  claim_id bigint,
  shipment_id bigint,
  incident_type public.incident_type not null,
  occurred_at timestamptz not null,
  affects_reputation boolean,
  affect_source text not null default 'calculated',
  exclusion_reason text,
  projected_expiry_at timestamptz,
  last_evaluated_at timestamptz not null default now(),
  source_key text not null,
  unique (meli_account_id, incident_type, source_key)
);
create index reputation_incidents_window_idx on public.reputation_incidents(meli_account_id, incident_type, occurred_at desc);
create table public.reputation_computations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  rule_set_id uuid references public.reputation_rule_sets(id),
  computed_at timestamptz not null default now(),
  window_start timestamptz,
  window_end timestamptz,
  claims_value integer,
  claims_denominator integer,
  claims_rate numeric(10,8),
  cancellations_value integer,
  cancellations_denominator integer,
  cancellations_rate numeric(10,8),
  delay_value integer,
  delay_denominator integer,
  delay_rate numeric(10,8),
  headroom jsonb not null default '{}'::jsonb,
  projections jsonb not null default '{}'::jsonb,
  drift jsonb not null default '{}'::jsonb,
  fidelity public.fidelity_status not null default 'initializing'
);
create index reputation_computations_account_time_idx on public.reputation_computations(meli_account_id, computed_at desc);
