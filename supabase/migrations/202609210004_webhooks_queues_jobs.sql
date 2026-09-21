-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- webhook inbox / jobs ----------
create table public.webhook_dedupe (
  event_key text primary key,
  first_received_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days')
);
create index webhook_dedupe_expiry_idx on public.webhook_dedupe(expires_at);
create table public.webhook_events (
  id uuid not null default gen_random_uuid(),
  received_at timestamptz not null default now(),
  event_key text not null,
  org_id uuid references public.organizations(id) on delete cascade,
  meli_account_id uuid references public.meli_accounts(id) on delete cascade,
  external_event_id text,
  topic text not null,
  resource text not null,
  user_id bigint,
  application_id bigint,
  sent_at timestamptz,
  attempts integer,
  actions jsonb,
  status text not null default 'queued' check (status in ('queued','processed','ignored','failed','security_rejected')),
  processing_error text,
  processed_at timestamptz,
  primary key (id, received_at)
) partition by range (received_at);
create table public.webhook_events_default partition of public.webhook_events default;
create index webhook_events_account_time_idx on public.webhook_events(meli_account_id, received_at desc);
create index webhook_events_resource_idx on public.webhook_events(meli_account_id, topic, resource, received_at desc);
create index webhook_events_status_idx on public.webhook_events(status, received_at) where status in ('queued','failed');
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  kind text not null,
  resource_kind text,
  status public.job_status not null default 'queued',
  priority integer not null default 50,
  range_start timestamptz,
  range_end timestamptz,
  cursor jsonb not null default '{}'::jsonb,
  progress numeric(6,5) not null default 0 check (progress between 0 and 1),
  processed_count bigint not null default 0,
  estimated_total bigint,
  attempts integer not null default 0,
  next_run_at timestamptz not null default now(),
  locked_by uuid,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sync_jobs_ready_idx on public.sync_jobs(status, priority desc, next_run_at)
  where status in ('queued','running','failed');
create index sync_jobs_account_idx on public.sync_jobs(meli_account_id, kind, created_at desc);
create table public.sync_checkpoints (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  resource_kind text not null,
  high_watermark timestamptz,
  cursor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (meli_account_id, resource_kind)
);
