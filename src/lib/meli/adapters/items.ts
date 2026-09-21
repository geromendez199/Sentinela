import type { MeliItem, MeliUserProductStock } from '../types/items';

export interface NormalizedItem {
  itemId: string;
  title: string | null;
  status: string | null;
  categoryId: string | null;
  permalink: string | null;
  availableQuantity: number | null;
  logisticType: string | null;
  sourceLastUpdated: string | null;
  userProductIds: string[];
}

export function normalizeItem(item: MeliItem): NormalizedItem {
  const variationProducts = (item.variations ?? [])
    .map((variation) => variation.user_product_id)
    .filter((id): id is string => typeof id === 'string');

  return {
    itemId: item.id,
    title: item.title ?? null,
    status: item.status ?? null,
    categoryId: item.category_id ?? null,
    permalink: item.permalink ?? null,
    // Not a stock source for multi-origin listings (section 3.1).
    availableQuantity: item.available_quantity ?? null,
    logisticType: item.shipping?.logistic_type ?? null,
    sourceLastUpdated: item.last_updated ?? null,
    userProductIds: item.user_product_id ? [item.user_product_id, ...variationProducts] : variationProducts,
  };
}

export interface NormalizedStock {
  total: number | null;
  lastUpdated: string | null;
  fulfillment: number | null;
  sellerWarehouse: number | null;
}

export function normalizeUserProductStock(stock: MeliUserProductStock): NormalizedStock {
  const locations = stock.locations ?? [];
  const byType = (type: string) =>
    locations
      .filter((location) => location.type?.toLowerCase() === type)
      .reduce((sum, location) => sum + (location.quantity ?? 0), 0);

  return {
    total: stock.total ?? null,
    lastUpdated: stock.last_updated ?? null,
    fulfillment: locations.some((l) => l.type?.toLowerCase() === 'meli_facility') ? byType('meli_facility') : null,
    sellerWarehouse: locations.some((l) => l.type?.toLowerCase() === 'selling_address') ? byType('selling_address') : null,
  };
}
