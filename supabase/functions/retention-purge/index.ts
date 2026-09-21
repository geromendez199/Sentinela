import { adminClient } from '../_shared/db.ts';
import { log } from '../_shared/logging.ts';

/**
 * Retention purge (section 14). A legal hold always wins: nothing under hold is
 * ever deleted, whatever the configured retention says.
 */

const DEFAULT_RETENTION: Record<string, number> = {
  webhook_events: 30,
  messages: 400,
  claim_messages: 400,
  questions: 400,
  ai_classifications: 400,
  root_cause_documents: 540,
  risk_scores: 540,
  security_audit_log: 730,
  internal_metrics: 180,
};

const TIME_COLUMN: Record<string, string> = {
  webhook_events: 'received_at',
  messages: 'date_created',
  claim_messages: 'date_created',
  questions: 'date_created',
  ai_classifications: 'created_at',
  root_cause_documents: 'created_at',
  risk_scores: 'computed_at',
  security_audit_log: 'created_at',
  internal_metrics: 'recorded_at',
};

Deno.serve(async () => {
  const { data: organizations } = await adminClient().from('organizations').select('id');
  const { data: policies } = await adminClient()
    .from('retention_policies')
    .select('org_id, entity, retention_days, legal_hold');

  const policyMap = new Map(
    (policies ?? []).map((policy) => [`${policy.org_id}:${policy.entity}`, policy]),
  );

  const purged: Record<string, number> = {};

  for (const organization of organizations ?? []) {
    for (const [entity, defaultDays] of Object.entries(DEFAULT_RETENTION)) {
      const policy = policyMap.get(`${organization.id}:${entity}`);
      if (policy?.legal_hold) continue;

      const days = policy?.retention_days ?? defaultDays;
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const column = TIME_COLUMN[entity];
      if (!column) continue;

      const { error, count } = await adminClient()
        .from(entity)
        .delete({ count: 'exact' })
        .eq('org_id', organization.id)
        .lt(column, cutoff);

      if (error) {
        log('warn', 'retention_purge_failed', { entity, error: error.code ?? 'unknown' });
        continue;
      }
      purged[entity] = (purged[entity] ?? 0) + (count ?? 0);
    }
  }

  return new Response(JSON.stringify({ purged }), { headers: { 'Content-Type': 'application/json' } });
});
