import { adminClient } from '../_shared/db.ts';
import { loadNotificationsEnv } from '../_shared/env.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';
import { deadLetter, deleteMessage, readBatch, requeue } from '../_shared/queue.ts';

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
}): Promise<'sent' | 'not_requested'> {
  const env = loadNotificationsEnv();
  const channels = Array.isArray(alert.channels) ? alert.channels : [];
  const recipients = channels
    .filter((channel): channel is { type: string; to: string } => {
      if (!channel || typeof channel !== 'object') return false;
      const candidate = channel as { type?: unknown; to?: unknown };
      return candidate.type === 'email' && typeof candidate.to === 'string';
    })
    .map((channel) => channel.to.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  if (recipients.length === 0) return 'not_requested';
  if (env.notificationsProvider !== 'resend' || !env.notificationsApiKey || !env.notificationsFromEmail) {
    throw new Error('notification_provider_not_configured');
  }

  const payload = {
    severity: alert.severity,
    kind: alert.kind,
    title: alert.title,
    summary: alert.body.slice(0, 500),
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.notificationsApiKey}`,
      'Idempotency-Key': `sentinela-alert-${alert.id}`,
    },
    body: JSON.stringify({
      from: env.notificationsFromEmail,
      to: recipients,
      subject: `[Sentinela · ${payload.severity.toUpperCase()}] ${payload.title}`,
      text: `${payload.summary}\n\nIngresá a Sentinela para revisar el contexto y decidir una acción.`,
    }),
  });

  if (!response.ok) throw new Error(`notification_failed:${response.status}`);
  return 'sent';
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const messages = await readBatch<AlertJob>(QUEUE, 60, Math.min(50, body.batch_size ?? 20));

  let sent = 0;
  let throttled = 0;
  let skipped = 0;
  let deadLettered = 0;

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

      const outcome = await deliver(alert);
      if (outcome === 'not_requested') {
        skipped += 1;
        await deleteMessage(QUEUE, entry.msg_id);
        continue;
      }
      await adminClient().from('internal_metrics').insert({
        org_id: alert.org_id,
        name: `alert_delivered:${alert.kind}`,
        value: 1,
        labels: { severity: alert.severity },
      });

      await deleteMessage(QUEUE, entry.msg_id);
      sent += 1;
    } catch (error) {
      const failure = error instanceof Error ? error.message : 'unknown_notification_error';
      log('warn', 'alert_delivery_failed', { failure_class: error instanceof Error ? error.name : 'UnknownError' });
      if (entry.read_ct >= 3) {
        await deadLetter(QUEUE, entry, error instanceof Error ? error.name : 'UnknownError', failure);
        deadLettered += 1;
      } else await requeue(QUEUE, entry.msg_id, 60 * entry.read_ct);
    }
  }

  return new Response(JSON.stringify({ sent, throttled, skipped, dead_lettered: deadLettered }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
