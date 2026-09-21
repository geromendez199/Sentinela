-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- ---------- enums ----------
create type public.org_role as enum ('owner','admin','operator','viewer');
create type public.meli_account_status as enum (
  'onboarding','backfilling','active','degraded','reconnect_required','restricted','disconnected'
);
create type public.job_status as enum ('queued','running','paused','done','failed','cancelled');
create type public.action_status as enum (
  'draft','pending_approval','approved','executing','executed','blocked_policy','failed','expired','cancelled'
);
create type public.incident_type as enum ('claim','cancellation','delay','mediation');
create type public.fidelity_status as enum ('initializing','calibrated','degraded','unknown');
create type public.message_actor_role as enum ('buyer','seller','meli_agent','system','unknown');
create type public.suggestion_status as enum ('new','accepted','rejected','applied','dismissed');
-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
