-- Sentinela ML - runtime safety discovered during real Supabase PG17 validation.
-- Edge-dependent cron workers must not run before Vault secrets and Edge Functions exist.

-- Avoid per-row auth.uid() re-evaluation in the insert RLS policy.
drop policy if exists playbook_rules_insert on public.playbook_rules;
create policy playbook_rules_insert on public.playbook_rules
for insert to authenticated
with check (
  public.org_role_for(org_id) in ('owner','admin')
  and created_by = (select auth.uid())
);

-- Keep only DB-local maintenance active after a fresh migration/reset.
-- These workers are explicitly enabled after Block 1 points 4-5 seed Vault secrets
-- and deploy/verify the corresponding Edge Functions.
do $$
declare
  r record;
begin
  for r in
    select jobid
    from cron.job
    where jobname in (
      'sentinela-resource-worker',
      'sentinela-backfill-worker',
      'sentinela-missed-feeds',
      'sentinela-reputation-reconcile',
      'sentinela-reputation-reconcile-normal',
      'sentinela-risk-score',
      'sentinela-classify-text',
      'sentinela-root-cause-cluster',
      'sentinela-outbound-alerts',
      'sentinela-retention-purge'
    )
  loop
    perform cron.alter_job(r.jobid, active := false);
  end loop;
end $$;
