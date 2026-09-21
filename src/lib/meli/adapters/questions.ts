import type { MeliQuestion } from '../types/questions';

export interface NormalizedQuestion {
  questionId: number;
  itemId: string | null;
  status: string | null;
  text: string;
  dateCreated: string | null;
  answered: boolean;
  answeredAt: string | null;
}

export function normalizeQuestion(question: MeliQuestion): NormalizedQuestion {
  return {
    questionId: question.id,
    itemId: question.item_id ?? null,
    status: question.status ?? null,
    text: question.text ?? '',
    dateCreated: question.date_created ?? null,
    answered: Boolean(question.answer?.text),
    answeredAt: question.answer?.date_created ?? null,
  };
}
