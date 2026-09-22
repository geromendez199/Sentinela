# Supabase PostgreSQL 17 validation

Validated against the real Sentinela staging project on 2026-09-21/22.

## Environment

- Supabase project ref: `jbgpktckgmnspuxlggwa`
- Role: staging
- Region: `us-west-2`
- PostgreSQL: `17.6.1`
- Repository branch: `claude/sentinela-completo-09415s`
- `supabase/config.toml` target: PostgreSQL 17

No MercadoLibre credentials, user data, production secrets, or production traffic were used during this validation.

## Migration result

The baseline migrations `202609210001` through `202609210012` applied successfully to a clean hosted Supabase PostgreSQL 17 project. Real-cloud validation then produced two follow-up migrations:

- `202609210013_security_hardening.sql`
  - converts public dashboard views to `security_invoker=true`;
  - removes anonymous access to those views and to public `SECURITY DEFINER` tenancy helpers;
  - enables RLS and removes browser grants on webhook dedupe/partition tables;
  - makes future webhook partitions receive the same hardening automatically;
  - discovers existing partitions dynamically so future `db reset` runs are calendar-independent.
- `202609210014_runtime_safety.sql`
  - optimizes the `playbook_rules_insert` RLS policy so `auth.uid()` is initialized once;
  - disables Edge-dependent cron jobs after a fresh migration/reset;
  - leaves only `sentinela-create-partitions` active until Vault secrets and Edge Functions are deployed and verified.

Hosted migration history was aligned to the repository filename versions because the Supabase management connector generates its own timestamp when applying a migration. The repository filenames remain the source of truth.

## Extensions and indexes verified

Real hosted extension versions observed during validation:

| Extension | Version | Schema |
| --- | --- | --- |
| `vector` | `0.8.2` | `extensions` |
| `pgmq` | `1.5.1` | `pgmq` |
| `pg_cron` | `1.6.4` | `pg_catalog` |
| `pg_net` | `0.20.4` | `extensions` |
| `supabase_vault` | `0.3.1` | `vault` |

`root_cause_embedding_hnsw` was verified as a real HNSW index over `root_cause_documents.embedding vector(1536)` with cosine operator class.

## Queues and Realtime verified

The durable pgmq queues exist:

- `meli_events`
- `derived_jobs`
- `outbound_alerts`

The `supabase_realtime` publication contains the dashboard-facing tables expected by the baseline:

- `meli_accounts`
- `reputation_snapshots`
- `reputation_computations`
- `risk_scores`
- `action_drafts`
- `alerts`

## Cron safety

The following jobs exist but remain inactive until Block 1 points 4-5 are complete:

- `sentinela-resource-worker`
- `sentinela-backfill-worker`
- `sentinela-missed-feeds`
- `sentinela-reputation-reconcile`
- `sentinela-reputation-reconcile-normal`
- `sentinela-risk-score`
- `sentinela-classify-text`
- `sentinela-root-cause-cluster`
- `sentinela-outbound-alerts`
- `sentinela-retention-purge`

`sentinela-create-partitions` remains active because it is database-local and requires no Edge Function or external secret.

Do not enable the Edge-dependent jobs until both Vault secrets (`sentinela:edge_base_url`, `sentinela:edge_service_key`) exist and every referenced Edge Function has been deployed and smoke-tested.

## RLS and security verification

A real transaction-level isolation probe created two temporary Auth users, two organizations, two MercadoLibre accounts, and two reputation snapshots. With the database role set to `authenticated` and JWT claims set to the Org A user, `public.latest_reputation` returned exactly one row and only the Org A account. The transaction was rolled back after the assertion.

Effective privilege checks after `0013` confirmed:

- `anon` cannot select `latest_reputation`;
- `anon` cannot execute `create_organization`;
- `anon` cannot execute `is_org_member`;
- `anon` cannot execute `org_role_for`;
- `authenticated` can select tenant-filtered dashboard views.

The hosted Supabase security advisor reported no ERROR-level findings after the hardening migration. Remaining advisor notices are intentional:

- backend-only webhook dedupe/partition tables have RLS enabled but no browser policy, giving deny-by-default behavior in addition to revoked browser grants;
- `create_organization`, `is_org_member`, and `org_role_for` remain `SECURITY DEFINER` for authenticated callers because they derive identity from `auth.uid()` and are used to avoid recursive membership RLS. They do not accept an arbitrary user id.

## Vault verification

A temporary Vault secret was created inside a database transaction, read through `vault.decrypted_secrets`, and validated for an exact round trip. The transaction was rolled back, so no probe secret remained.

This validates the real hosted Vault create/decrypt path. It does not substitute for the OAuth refresh concurrency tests in Block 4.

## Seed verification

The staging seed was applied idempotently and produced:

- 6 reputation rule sets;
- 1 active global heuristic model;
- 4 global MercadoLibre rate buckets.

No PII or credentials are present in the seed.

## Performance advisor

The hosted performance advisor has no error-level findings. It currently reports informational unindexed foreign keys and unused indexes. Because staging is effectively empty, index usage statistics are not representative. Do not create every suggested FK index mechanically; evaluate them against the real query/workload profile during the scale/load phase.

## Outstanding items

This document closes the hosted PostgreSQL-17 schema/extension portion of Block 1 point 1 for staging. It does **not** claim completion of later Block 1 items:

1. `database.types.ts` still needs regeneration from the real schema while preserving generated Row definitions as `type` aliases.
2. Full pgTAP RLS suite still needs to be made green on real Supabase Auth/RLS.
3. Vault Edge invocation secrets are intentionally not seeded yet.
4. Edge Functions are intentionally not deployed yet; dependent cron jobs therefore remain paused.
5. Production project creation remains pending the production-region decision.
6. The 50 informational unindexed-FK advisor findings are deferred to workload-driven performance validation, not silently dismissed.
