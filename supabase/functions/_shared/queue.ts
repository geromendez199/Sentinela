import { adminClient } from './db.ts';

export interface QueueMessage<T> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  message: T;
}

/**
 * pgmq helpers. Visibility timeout, not deletion, guards a message while a
 * worker runs: a crash re-delivers it and every worker is idempotent.
 */
export async function readBatch<T>(
  queue: string,
  visibilitySeconds: number,
  qty: number,
): Promise<Array<QueueMessage<T>>> {
  const { data, error } = await adminClient().schema('pgmq_public').rpc('read', {
    queue_name: queue,
    sleep_seconds: visibilitySeconds,
    n: qty,
  });
  if (error) throw new Error(`pgmq_read_failed:${error.code ?? 'unknown'}`);
  return (data ?? []) as Array<QueueMessage<T>>;
}

export async function archive(queue: string, msgId: number): Promise<void> {
  await adminClient().schema('pgmq_public').rpc('archive', { queue_name: queue, message_id: msgId });
}

export async function deleteMessage(queue: string, msgId: number): Promise<void> {
  await adminClient().schema('pgmq_public').rpc('delete', { queue_name: queue, message_id: msgId });
}

/** Re-hides a message so it is retried later instead of spinning. */
export async function requeue(queue: string, msgId: number, delaySeconds: number): Promise<void> {
  await adminClient().schema('pgmq_public').rpc('set_vt', {
    queue_name: queue,
    message_id: msgId,
    vt_offset: delaySeconds,
  });
}

export async function send(queue: string, message: Record<string, unknown>): Promise<void> {
  const { error } = await adminClient().schema('pgmq_public').rpc('send', {
    queue_name: queue,
    message,
  });
  if (error) throw new Error(`pgmq_send_failed:${error.code ?? 'unknown'}`);
}
