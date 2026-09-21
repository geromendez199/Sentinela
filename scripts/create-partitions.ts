/**
 * Creates webhook_events partitions ahead of time. A default partition already
 * prevents data loss, but running behind it degrades query planning.
 */
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const monthsAhead = Number(process.env.PARTITION_MONTHS_AHEAD ?? 3);

  for (let offset = 0; offset <= monthsAhead; offset++) {
    const target = new Date();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + offset);
    const month = target.toISOString().slice(0, 10);

    const { error } = await supabase.rpc('backend_create_webhook_partition', { p_month: month });
    if (error) {
      console.error(`Failed for ${month}: ${error.code ?? 'unknown'}`);
      process.exit(2);
    }
    console.log(`Partition ready for ${month}`);
  }
}

void main();
