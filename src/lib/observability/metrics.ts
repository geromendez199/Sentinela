import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from './logger';

/**
 * Internal metrics only. Section 0.2 forbids adding another observability vendor,
 * so counters land in Postgres and are read back by the operations dashboard.
 */
export interface MetricPoint {
  name: string;
  value: number;
  org_id?: string;
  meli_account_id?: string;
  labels?: Record<string, string | number | boolean>;
}

export async function recordMetric(point: MetricPoint): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.rpc('backend_record_metric' as never, {
      p_name: point.name,
      p_value: point.value,
      p_org_id: point.org_id ?? null,
      p_meli_account_id: point.meli_account_id ?? null,
      p_labels: point.labels ?? {},
    } as never);
  } catch (error) {
    // Telemetry must never break a request path.
    logger.warn('metric_record_failed', { event: point.name, error });
  }
}
