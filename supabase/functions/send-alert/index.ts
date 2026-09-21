import { adminClient } from '../_shared/db.ts';
import { loadEnv } from '../_shared/env.ts';
import { log } from '../_shared/logging.ts';
import { deleteMessage, readBatch, requeue } from '../_shared/queue.ts';

/**
 * Outbound alerting. The payload is minimal and operational: no buyer PII, no
 * tokens, no full resource dumps. Throttling and dedupe live here so a storm of
 * events cannot become a storm of notifications.
 */

const QUEUE = 'outbound_alerts';
const THROTTLE_MINUTES = 15;

interface AlertJob {
  alert_id: string;
  org_id: string;
}

async function deliver(alert: {
  id: string;
  org_id: string;
  severity: string;
  kind: string;
  title: string;
  body: string;
  channels: unknown;
}): Promise<void> {
  const env = loadEnv();
  if (env.notificationsProvider === 'none' || !env.notificationsApiKey) {
    log('info', 'alert_delivery_skipped', { alert_id: alert.id, reason: 'provider_disabled' });
    return;
  }

  // Minimal operational payload only.
  const payload = {
    severity: alert.severity,
    kind: alert.kind,
    title: alert.title,
    summary: alert.body.slice(0, 500),
  };

  const response = await fetch(`https://api.${env.notificationsProvider}.example/v1/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.notificationsApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`notification_failed:${response.status}`);
}

Deno.serve(async (request) => {
  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const messages = await readBatch<AlertJob>(QUEUE, 60, Math.min(50, body.batch_size ?? 20));

  let sent = 0;
  let throttled = 0;

  for (const entry of messages) {
    try {
      const { data: alert } = await adminClient()
        .from('alerts')
        .select('id, org_id, severity, kind, title, body, channels, created_at, status')
        .eq('id', entry.message.alert_id)
        .maybeSingle();

      if (!alert || alert.status !== 'open') {
        await deleteMessage(QUEUE, entry.msg_id);
        continue;
      }

      // Dedupe: an identical kind delivered recently is not repeated.
      const since = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString();
      const { count } = await adminClient()
        .from('internal_metrics')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', alert.org_id)
        .eq('name', `alert_delivered:${alert.kind}`)
        .gte('recorded_at', since);

      if ((count ?? 0) > 0) {
        throttled += 1;
        await deleteMessage(QUEUE, entry.msg_id);
        continue;
      }

      await deliver(alert);
      await adminClient().from('internal_metrics').insert({
        org_id: alert.org_id,
        name: `alert_delivered:${alert.kind}`,
        value: 1,
        labels: { severity: alert.severity },
      });

      await deleteMessage(QUEUE, entry.msg_id);
      sent += 1;
    } catch (error) {
      log('warn', 'alert_delivery_failed', { error: String(error) });
      if (entry.read_ct >= 4) await deleteMessage(QUEUE, entry.msg_id);
      else await requeue(QUEUE, entry.msg_id, 60 * entry.read_ct);
    }
  }

  return new Response(JSON.stringify({ sent, throttled }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
