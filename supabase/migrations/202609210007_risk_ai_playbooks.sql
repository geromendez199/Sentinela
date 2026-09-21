-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- risk engine ----------
create table public.risk_model_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  version text not null,
  model_type text not null check (model_type in ('heuristic','logistic','gbdt_compact')),
  intercept numeric not null default 0,
  weights jsonb not null,
  thresholds jsonb not null,
  feature_schema_version text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique nulls not distinct (org_id, name, version)
);
create unique index one_active_model_per_org_name
  on public.risk_model_versions(coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  where active;
create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  order_id bigint,
  pack_id bigint,
  model_version_id uuid not null references public.risk_model_versions(id),
  computed_at timestamptz not null default now(),
  risk_probability numeric(7,6) not null check (risk_probability between 0 and 1),
  claim_risk numeric(7,6) check (claim_risk between 0 and 1),
  cancellation_risk numeric(7,6) check (cancellation_risk between 0 and 1),
  delay_risk numeric(7,6) check (delay_risk between 0 and 1),
  risk_band text not null check (risk_band in ('low','medium','high','critical')),
  explanations jsonb not null default '[]'::jsonb,
  feature_hash text not null,
  expires_at timestamptz
);
create index risk_scores_order_latest_idx on public.risk_scores(meli_account_id, order_id, computed_at desc);
create index risk_scores_open_priority_idx on public.risk_scores(meli_account_id, risk_band, computed_at desc)
  where risk_band in ('high','critical');
create table public.risk_score_features (
  risk_score_id uuid not null references public.risk_scores(id) on delete cascade,
  feature_name text not null,
  raw_value numeric,
  normalized_value numeric,
  weight numeric,
  contribution numeric,
  source text,
  primary key (risk_score_id, feature_name)
);
-- ---------- AI classifications / vector RCA ----------
create table public.ai_classifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  provider text not null,
  model text not null,
  schema_version text not null,
  intent text not null,
  sentiment numeric(4,3) check (sentiment between -1 and 1),
  urgency numeric(4,3) check (urgency between 0 and 1),
  claim_risk numeric(4,3) check (claim_risk between 0 and 1),
  labels text[] not null default '{}'::text[],
  sanitized_input_hash text not null,
  output jsonb not null,
  created_at timestamptz not null default now(),
  unique (meli_account_id, source_type, source_id, schema_version, sanitized_input_hash)
);
create index ai_classifications_source_idx on public.ai_classifications(meli_account_id, source_type, source_id);
create table public.root_cause_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  item_id text,
  source_type text not null,
  source_id text not null,
  text_sanitized text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  retention_until timestamptz,
  unique (meli_account_id, source_type, source_id)
);
create index root_cause_item_idx on public.root_cause_documents(meli_account_id, item_id, created_at desc);
create index root_cause_embedding_hnsw on public.root_cause_documents
  using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null;
create table public.root_cause_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  item_id text not null,
  label text not null,
  centroid extensions.vector(1536),
  sample_count integer not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  trend_score numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index root_cause_clusters_item_idx on public.root_cause_clusters(meli_account_id, item_id, trend_score desc);
create table public.listing_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  item_id text not null,
  cluster_id uuid references public.root_cause_clusters(id) on delete set null,
  suggestion_type text not null check (suggestion_type in 
('title','attributes','photos','description','size_guide','stock','other')),
  rationale text not null,
  proposed_change jsonb not null,
  evidence_count integer not null default 0,
  status public.suggestion_status not null default 'new',
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);
-- ---------- playbooks / action approvals ----------
create table public.playbook_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid references public.meli_accounts(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger_kind text not null,
  conditions jsonb not null,
  actions jsonb not null,
  requires_approval boolean not null default true,
  priority integer not null default 50,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index playbook_rules_account_idx on public.playbook_rules(org_id, meli_account_id, enabled, priority desc);
create table public.action_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  order_id bigint,
  pack_id bigint,
  claim_id bigint,
  item_id text,
  kind text not null,
  status public.action_status not null default 'draft',
  requires_approval boolean not null default true,
  payload_sanitized jsonb not null default '{}'::jsonb,
  rendered_text text,
  policy_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_by_system boolean not null default true,
  created_by_user uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  external_result jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index action_drafts_queue_idx on public.action_drafts(org_id, status, created_at desc);
create index action_drafts_resource_idx on public.action_drafts(meli_account_id, order_id, claim_id, item_id);
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid references public.meli_accounts(id) on delete cascade,
  severity text not null check (severity in ('info','warning','high','critical')),
  kind text not null,
  title text not null,
  body text not null,
  resource_type text,
  resource_id text,
  channels jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','suppressed')),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index alerts_open_idx on public.alerts(org_id, severity, created_at desc) where status='open';
-- ---------- privacy / retention ----------
create table public.retention_policies (
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null,
  retention_days integer not null check (retention_days between 1 and 3650),
  legal_hold boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (org_id, entity)
);
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check (request_type in ('access','rectification','deletion','restriction','other')),
  subject_reference_hash text not null,
  status text not null default 'open',
  received_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  notes text
);
