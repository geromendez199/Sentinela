import type { MeliOrder } from '../types/orders';

export interface NormalizedOrder {
  orderId: number;
  packId: number | null;
  shipmentId: number | null;
  status: string;
  tags: string[];
  dateCreated: string;
  dateClosed: string | null;
  sourceLastUpdated: string;
  fulfilled: boolean | null;
  sellerCancelled: boolean | null;
  currencyId: string | null;
  totalAmount: number | null;
  buyerId: number | null;
  items: Array<{
    itemId: string;
    variationId: number | null;
    userProductId: string | null;
    sellerSku: string | null;
    categoryId: string | null;
    quantity: number;
    unitPrice: number | null;
  }>;
  rawSanitized: Record<string, unknown>;
}

/**
 * Cancellation attribution (section 4.2): a cancellation initiated by the buyer
 * does not affect reputation. `cancel_detail.requested_by` is the only signal
 * available here; the twin refines it against claims.
 */
function sellerAttributedCancellation(order: MeliOrder): boolean | null {
  if (order.status !== 'cancelled') return false;
  const requestedBy = order.cancel_detail?.requested_by?.toLowerCase();
  if (!requestedBy) return null;
  return requestedBy === 'seller';
}

export function normalizeOrder(order: MeliOrder): NormalizedOrder {
  return {
    orderId: order.id,
    packId: order.pack_id ?? null,
    shipmentId: order.shipping?.id ?? null,
    status: order.status ?? 'unknown',
    tags: order.tags ?? [],
    dateCreated: order.date_created ?? new Date().toISOString(),
    dateClosed: order.date_closed ?? null,
    sourceLastUpdated: order.last_updated ?? order.date_created ?? new Date().toISOString(),
    fulfilled: order.fulfilled ?? null,
    sellerCancelled: sellerAttributedCancellation(order),
    currencyId: order.currency_id ?? null,
    totalAmount: order.total_amount ?? null,
    buyerId: order.buyer?.id ?? null,
    items: (order.order_items ?? []).map((entry) => ({
      itemId: entry.item?.id ?? 'unknown',
      variationId: entry.item?.variation_id ?? null,
      userProductId: entry.user_product_id ?? null,
      sellerSku: entry.item?.seller_sku ?? null,
      categoryId: entry.item?.category_id ?? null,
      quantity: entry.quantity ?? 1,
      unitPrice: entry.unit_price ?? null,
    })),
    // Diagnostic subset only: no buyer name, address, document or payment data.
    rawSanitized: {
      status_detail: order.status_detail ?? null,
      tags: order.tags ?? [],
      cancel_code: order.cancel_detail?.code ?? null,
    },
  };
}
