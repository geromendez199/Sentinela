export interface SellerReputationMetric {
  period?: string;
  rate?: number;
  value?: number;
  excluded?: { real_value?: number; real_rate?: number } | null;
}

export interface SellerReputation {
  level_id?: string | null;
  power_seller_status?: string | null;
  transactions?: {
    period?: string;
    completed?: number;
    canceled?: number;
    total?: number;
    ratings?: { positive?: number; negative?: number; neutral?: number };
  };
  metrics?: {
    claims?: SellerReputationMetric;
    cancellations?: SellerReputationMetric;
    delayed_handling_time?: SellerReputationMetric;
    sales?: { period?: string; completed?: number };
  };
  protection_end_date?: string | null;
}

export interface MeliUser {
  id: number;
  nickname?: string;
  site_id?: string;
  user_type?: string;
  tags?: string[];
  status?: { site_status?: string };
  seller_reputation?: SellerReputation;
}
