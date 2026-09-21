export interface MeliItem {
  id: string;
  title?: string;
  status?: string;
  category_id?: string;
  permalink?: string;
  available_quantity?: number;
  sold_quantity?: number;
  last_updated?: string;
  seller_custom_field?: string | null;
  variations?: Array<{ id: number; available_quantity?: number; user_product_id?: string | null }>;
  shipping?: { logistic_type?: string; mode?: string };
  user_product_id?: string | null;
}

export interface MeliItemsBulkEntry {
  code: number;
  body: MeliItem;
}

export interface MeliUserProductStock {
  user_product_id?: string;
  total?: number;
  locations?: Array<{ type?: string; quantity?: number; store_id?: string | null }>;
  last_updated?: string;
}
