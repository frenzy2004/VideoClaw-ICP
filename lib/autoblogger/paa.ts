import type { ApifyObservationProvenance } from './research';
import { normalizeKeyword } from './domain';
import { containsSecretLikeValue } from './secrets';

export const PAA_ACTOR_ID = 'santhej/people-also-ask-scraper';

export type PaaObservation = ApifyObservationProvenance & {
  question: string;
  parentQuestion: string | null;
  query: string;
  country: 'US';
  language: 'en';
  position: number;
};

export function normalizePaaRows(rows: unknown[], query: string, provenance: ApifyObservationProvenance): {
  questions: string[]; relatedSearches: string[]; observations: PaaObservation[];
} {
  const observations: PaaObservation[] = [];
  const relatedSearches: string[] = [];
  const seen = new Set<string>();
  const safeText = (value: unknown): value is string => typeof value === 'string'
    && value.trim().length > 0 && value.length <= 500 && !containsSecretLikeValue(value);
  for (const item of rows.slice(0, 1_000)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.keyword !== 'string' || normalizeKeyword(row.keyword) !== normalizeKeyword(query)
      || String(row.country).toUpperCase() !== 'US' || row.language !== 'en'
      || typeof row.checked_at !== 'string' || !Number.isFinite(Date.parse(row.checked_at))) continue;
    if (row.record_type === 'related_searches' && Array.isArray(row.related_searches)) {
      relatedSearches.push(...row.related_searches.filter(safeText).slice(0, 20));
      continue;
    }
    if (row.record_type !== 'paa_question' || !safeText(row.question)
      || !Number.isSafeInteger(row.position) || Number(row.position) < 1) continue;
    const key = normalizeKeyword(row.question);
    if (seen.has(key) || observations.length >= 30) continue;
    seen.add(key);
    observations.push({
      ...provenance,
      query,
      question: row.question.trim(),
      parentQuestion: safeText(row.parent_question) ? row.parent_question.trim() : null,
      country: 'US', language: 'en', position: Number(row.position), observedAt: row.checked_at,
    });
  }
  return {questions:observations.map(({question}) => question),relatedSearches:[...new Set(relatedSearches)],observations};
}
