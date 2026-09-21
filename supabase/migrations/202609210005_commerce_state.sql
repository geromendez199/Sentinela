-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- commerce current state ----------
create table public.packs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  pack_id bigint not null,
  shipment_id bigint,
  source_last_updated timestamptz,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, pack_id)
);
create table public.orders (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  order_id bigint not null,
  pack_id bigint,
  shipment_id bigint,
  status text not null,
  tags text[] not null default '{}'::text[],
  date_created timestamptz not null,
  date_closed timestamptz,
  source_last_updated timestamptz not null,
  fulfilled boolean,
  seller_cancelled boolean,
  currency_id text,
  total_amount numeric(18,2),
  buyer_pseudonym text,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, order_id)
);
create index orders_account_created_idx on public.orders(meli_account_id, date_created desc);
create index orders_account_updated_idx on public.orders(meli_account_id, source_last_updated desc);
create index orders_pack_idx on public.orders(meli_account_id, pack_id) where pack_id is not null;
create index orders_open_idx on public.orders(meli_account_id, status, source_last_updated desc)
  where status not in ('cancelled','closed');
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  order_id bigint not null,
  item_id text not null,
  variation_id bigint,
  user_product_id text,
  seller_sku_hash text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(18,2),
  created_at timestamptz not null default now(),
  unique (meli_account_id, order_id, item_id, variation_id, user_product_id)
);
create index order_items_item_idx on public.order_items(meli_account_id, item_id, order_id);
create table public.shipments (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  shipment_id bigint not null,
  pack_id bigint,
  status text,
  substatus text,
  mode text,
  logistic_type text,
  service_id text,
  expected_dispatch_at timestamptz,
  sla_status text,
  sla_service text,
  sla_last_updated timestamptz,
  date_created timestamptz,
  source_last_updated timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, shipment_id)
);
create index shipments_sla_idx on public.shipments(meli_account_id, expected_dispatch_at)
  where expected_dispatch_at is not null and delivered_at is null;
create index shipments_pack_idx on public.shipments(meli_account_id, pack_id) where pack_id is not null;
create table public.shipment_status_history (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  shipment_id bigint not null,
  status text,
  substatus text,
  event_at timestamptz not null,
  source text not null default 'meli',
  unique (meli_account_id, shipment_id, status, substatus, event_at)
);
create index shipment_history_idx on public.shipment_status_history(meli_account_id, shipment_id, event_at);
create table public.items (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  item_id text not null,
  user_product_id text,
  inventory_id text,
  title text,
  category_id text,
  status text,
  sub_status text[] not null default '{}'::text[],
  available_quantity integer,
  logistic_types text[] not null default '{}'::text[],
  warehouse_management boolean,
  health numeric(6,5),
  source_last_updated timestamptz,
  raw_sanitized jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, item_id)
);
create index items_status_idx on public.items(meli_account_id, status, source_last_updated desc);
create index items_user_product_idx on public.items(meli_account_id, user_product_id) where user_product_id is not null;
create table public.user_product_stock (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  user_product_id text not null,
  stock_version bigint,
  total_seller_stock integer,
  full_stock integer,
  locations jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  primary key (meli_account_id, user_product_id)
);
-- ---------- communications ----------
create table public.questions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  question_id bigint not null,
  item_id text,
  status text,
  text_sanitized text,
  date_created timestamptz,
  answered_at timestamptz,
  source_last_updated timestamptz,
  classification_id uuid,
  primary key (meli_account_id, question_id)
);
create index questions_item_idx on public.questions(meli_account_id, item_id, date_created desc);
create table public.messages (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  message_id text not null,
  pack_id bigint,
  order_id bigint,
  conversation_path text,
  actor_role public.message_actor_role not null default 'unknown',
  text_sanitized text,
  date_created timestamptz not null,
  date_available timestamptz,
  date_received timestamptz,
  moderation_status text,
  attachment_count integer not null default 0,
  classification_id uuid,
  raw_sanitized jsonb not null default '{}'::jsonb,
  primary key (meli_account_id, message_id)
);
create index messages_pack_time_idx on public.messages(meli_account_id, pack_id, date_created desc);
