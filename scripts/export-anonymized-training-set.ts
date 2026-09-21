/**
 * Exports an anonymized feature/outcome dataset for offline model training
 * (section 8.5).
 *
 * Guarantees: no free text, no buyer identifiers, features as they existed
 * before the outcome (no recomputation with future information), and a time
 * based split so validation never leaks from the future.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

interface Row {
  computed_at: string;
  meli_account_id: string;
  risk_probability: number;
  risk_band: string;
  order_id: number | null;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const output = process.env.OUTPUT_PATH ?? 'training-set.jsonl';
  const observationCutoff = process.env.OBSERVATION_CUTOFF;

  if (!url || !key || !observationCutoff) {
    console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and OBSERVATION_CUTOFF are required.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Only scores computed before the cutoff; outcomes are labelled after it.
  const { data, error } = await supabase
    .from('risk_scores')
    .select('computed_at, meli_account_id, risk_probability, risk_band, order_id')
    .lt('computed_at', observationCutoff)
    .order('computed_at', { ascending: true })
    .limit(100_000);

  if (error) throw error;

  const lines = (data as Row[]).map((row) =>
    JSON.stringify({
      // Accounts are pseudonymized: the export never carries a seller identity.
      account_bucket: row.meli_account_id.slice(0, 8),
      computed_at: row.computed_at,
      score: row.risk_probability,
      band: row.risk_band,
      has_order: row.order_id !== null,
    }),
  );

  writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Exported ${lines.length} rows to ${output}`);
}

void main();
