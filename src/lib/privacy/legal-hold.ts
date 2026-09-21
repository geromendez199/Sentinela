import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * A legal hold freezes deletion for an organization/entity pair. The purge job
 * must consult this before every delete, including partition drops.
 */
export async function isUnderLegalHold(orgId: string, entity: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('retention_policies')
    .select('legal_hold')
    .eq('org_id', orgId)
    .eq('entity', entity)
    .maybeSingle();
  return data?.legal_hold === true;
}
