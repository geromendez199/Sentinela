export interface MeliQuestion {
  id: number;
  seller_id?: number;
  item_id?: string;
  status?: string;
  text?: string;
  date_created?: string;
  from?: { id?: number };
  answer?: { text?: string; status?: string; date_created?: string } | null;
}

export interface MeliQuestionsSearchResponse {
  questions: MeliQuestion[];
  total: number;
  limit?: number;
  offset?: number;
}
