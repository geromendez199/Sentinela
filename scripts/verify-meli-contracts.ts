/**
 * Contract probe for every endpoint Sentinela depends on.
 *
 * It does not enable anything by itself: it reports which [NO VERIFICADO]
 * contracts responded as documented so docs/verification-matrix.md and the
 * capability flags can be updated deliberately.
 *
 * Usage: MELI_TEST_ACCESS_TOKEN=... npm run verify:contracts
 */
interface Probe {
  name: string;
  path: string;
  verification: 'verified' | 'conflict' | 'unverified';
  requiresIds?: string[];
}

const PROBES: Probe[] = [
  { name: 'users.get', path: '/users/me', verification: 'unverified' },
  { name: 'sites', path: '/sites', verification: 'unverified' },
  { name: 'orders.search', path: '/orders/search?seller={sellerId}&limit=1', verification: 'unverified', requiresIds: ['sellerId'] },
  { name: 'claims.search', path: '/post-purchase/v1/claims/search?limit=1', verification: 'unverified' },
  { name: 'shipments.sla', path: '/shipments/{shipmentId}/sla', verification: 'unverified', requiresIds: ['shipmentId'] },
  { name: 'claims.affects_reputation', path: '/post-purchase/v1/claims/{claimId}/affects-reputation', verification: 'unverified', requiresIds: ['claimId'] },
  { name: 'messages.action_guide', path: '/messages/action_guide/packs/{packId}?tag=post_sale', verification: 'unverified', requiresIds: ['packId'] },
  { name: 'missed_feeds', path: '/missed_feeds?app_id={appId}', verification: 'unverified', requiresIds: ['appId'] },
];

async function probe(entry: Probe, token: string, ids: Record<string, string>): Promise<void> {
  const missing = (entry.requiresIds ?? []).filter((id) => !ids[id]);
  if (missing.length > 0) {
    console.log(`SKIP  ${entry.name} (missing ${missing.join(', ')})`);
    return;
  }

  const path = entry.path.replace(/\{(\w+)\}/g, (_, key: string) => ids[key] ?? '');
  const response = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  const status = response.ok ? 'OK  ' : 'FAIL';
  console.log(`${status}  ${entry.name} -> HTTP ${response.status} [${entry.verification}]`);
}

async function main(): Promise<void> {
  const token = process.env.MELI_TEST_ACCESS_TOKEN;
  if (!token) {
    console.error('MELI_TEST_ACCESS_TOKEN is required and must belong to a test account.');
    process.exit(1);
  }

  const ids: Record<string, string> = {
    sellerId: process.env.MELI_TEST_SELLER_ID ?? '',
    shipmentId: process.env.MELI_TEST_SHIPMENT_ID ?? '',
    claimId: process.env.MELI_TEST_CLAIM_ID ?? '',
    packId: process.env.MELI_TEST_PACK_ID ?? '',
    appId: process.env.MELI_APP_ID ?? '',
  };

  for (const entry of PROBES) await probe(entry, token, ids);
}

void main();

export {};
