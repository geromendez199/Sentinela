import { rpc } from './db.ts';

export interface QueueMessage<T> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  message: T;
}

/**
 * PGMQ helpers through backend-only public RPCs. pgmq_public intentionally
 * remains outside the exposed Data API schemas.
 */
export async function readBatch<T>(
  queue: string,
  visibilitySeconds: number,
  qty: number,
): Promise<Array<QueueMessage<T>>> {
  const data = await rpc<Array<QueueMessage<T>>>('backend_queue_read', {
    p_queue: queue,
    p_visibility_seconds: visibilitySeconds,
    p_qty: qty,
  });
  return data ?? [];
}

export async function archive(queue: string, msgId: number): Promise<void> {
  // Archiving is not used by current workers; deleting after successful,
  // idempotent processing is the intended lifecycle.
  await deleteMessage(queue, msgId);
}

export async function deleteMessage(queue: string, msgId: number): Promise<void> {
  await rpc<boolean>('backend_queue_delete', {
    p_queue: queue,
    p_msg_id: msgId,
  });
}

export async function requeue(queue: string, msgId: number, delaySeconds: number): Promise<void> {
  await rpc<boolean>('backend_queue_set_vt', {
    p_queue: queue,
    p_msg_id: msgId,
    p_delay_seconds: delaySeconds,
  });
}

export async function send(queue: string, message: Record<string, unknown>): Promise<void> {
  await rpc<number>('backend_queue_send', {
    p_queue: queue,
    p_message: message,
  });
}

export async function sendOnce(
  queue: string,
  idempotencyKey: string,
  message: Record<string, unknown>,
): Promise<void> {
  await rpc<number>('backend_queue_send_once', {
    p_queue: queue,
    p_idempotency_key: idempotencyKey,
    p_message: message,
  });
}

export async function deadLetter<T>(
  sourceQueue: string,
  entry: QueueMessage<T>,
  failureClass: string,
  failureReason: string,
): Promise<void> {
  await rpc<number>('backend_queue_dead_letter', {
    p_source_queue: sourceQueue,
    p_source_message_id: entry.msg_id,
    p_source_read_count: entry.read_ct,
    p_message: entry.message,
    p_failure_class: failureClass,
    p_failure_reason: failureReason,
  });
}
