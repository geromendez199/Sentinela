export interface MeliOrderItem {
  item?: { id?: string; variation_id?: number | null; seller_sku?: string | null; category_id?: string | null };
  quantity?: number;
  unit_price?: number;
  user_product_id?: string | null;
}

export interface MeliOrder {
  id: number;
  status?: string;
  status_detail?: string | null;
  tags?: string[];
  date_created?: string;
  date_closed?: string | null;
  last_updated?: string;
  pack_id?: number | null;
  shipping?: { id?: number | null };
  currency_id?: string;
  total_amount?: number;
  fulfilled?: boolean | null;
  order_items?: MeliOrderItem[];
  buyer?: { id?: number; nickname?: string };
  cancel_detail?: { requested_by?: string; code?: string; description?: string } | null;
}

export interface MeliOrdersSearchResponse {
  results: MeliOrder[];
  paging: { total: number; offset: number; limit: number };
}

export interface MeliPack {
  id: number;
  status?: string;
  shipment?: { id?: number | null } | null;
  orders?: Array<{ id: number }>;
}
