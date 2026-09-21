-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- linked MercadoLibre accounts ----------
create table public.meli_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  seller_id bigint not null unique,
  site_id text not null check (site_id in ('MLA','MLB','MLM','MLC','MCO','MLU')),
  nickname text,
  country_code text,
  timezone text not null default 'UTC',
  status public.meli_account_status not null default 'onboarding',
  power_seller_status text,
  level_id text,
  permissions jsonb not null default '{}'::jsonb,
  linked_by uuid references auth.users(id),
  linked_at timestamptz not null default now(),
  last_api_ok_at timestamptz,
  last_reputation_sync_at timestamptz,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meli_accounts_org_idx on public.meli_accounts(org_id, status);
create index meli_accounts_site_idx on public.meli_accounts(site_id, status);
-- ---------- private OAuth ----------
create table private.oauth_link_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null,
  state_hash bytea not null unique,
  pkce_verifier_secret_id uuid,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create table private.meli_oauth_credentials (
  meli_account_id uuid primary key references public.meli_accounts(id) on delete cascade,
  access_secret_id uuid not null,
  refresh_secret_id uuid not null,
  expires_at timestamptz not null,
  scope text[] not null default '{}'::text[],
  token_type text not null default 'Bearer',
  credential_version bigint not null default 1 check (credential_version > 0),
  refresh_lease_owner uuid,
  refresh_lease_until timestamptz,
  last_refresh_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);
create index meli_oauth_expiry_idx on private.meli_oauth_credentials(expires_at);
-- ---------- audit ----------
create table public.security_audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  meli_account_id uuid references public.meli_accounts(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  correlation_id uuid,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index security_audit_org_time_idx on public.security_audit_log(org_id, created_at desc);
