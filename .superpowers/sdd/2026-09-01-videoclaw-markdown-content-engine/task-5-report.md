# Task 5 Report — Live US Apify candidate and SERP evidence

## Status

Implemented locally; pending independent review at this checkpoint.

## Delivered

- `lib/keywords/apify-evidence.mjs`: strict autocomplete and first-page SERP normalization, result-type classification, retry selection, transparent observed-evidence scoring, and primary-to-secondary replacement when an observed primary contains no organic competitors.
- `lib/keywords/apify-evidence.test.ts`: literal Actor fixtures, wrong-locale/provenance failures, no-proprietary-metric scoring checks, all-five-matrix extraction, retry selection, and empty-primary replacement coverage.
- `scripts/research/collect-apify-evidence.mjs`: runtime-token-only collection/resume CLI with redacted errors, multi-run provenance, matrix parsing, candidate accounting, fail-closed organic-evidence selection, and manifest generation.
- `data/research/apify/run-manifest.json`: Actor, run, dataset, locale, device, observation time, and query-count provenance.
- Five normalized campaign evidence files.

## Observed totals

- Five campaigns.
- 200 unique matrix candidates per campaign; 1,000 total.
- 50 selected opportunities per campaign; 250 total and 250 unique selected queries.
- 1,121 normalized SERP observations across base, correction, and retry runs.
- 2,160 organic result records attached to the 250 selections.
- 225 matrix primaries retained; 25 empty or AI-overview-only primaries replaced with an observed secondary from the same article specification.
- Zero selected records with an empty organic result set.
- All volume, difficulty, and CPC values remain null with provider `pending`.

## Research corrections

- Autocomplete alone was sparse and noisy, so it was retained as discovery evidence rather than treated as demand volume.
- Broad `demo day video` results included unrelated event recordings and social pages; the query was not promoted merely because it was a seed.
- Official Google SERP runs sometimes returned an AI Overview but no organic results. Those responses remain auditable in the evidence file but cannot qualify an article. The collector prefers a successful retry and otherwise replaces the primary with a researched secondary that has first-page organic competitors.
- Two article specifications were refined from new US autocomplete evidence after every original candidate returned no organic competitors: `30 60 90 day marketing plan` and `how to make a product demo video`.

## TDD and verification evidence

Initial focused run failed because `apify-evidence.mjs` did not exist. The current focused suite passes 14 tests. Matrix extraction passes against all five 50-opportunity documents, and the collection CLI passes `node --check`.

Required final checks before commit:

```text
pnpm test lib/keywords/apify-evidence.test.ts
pnpm run typecheck
git diff --check
credential scan for the exact runtime token
```

## Boundary

Apify proves that a query and its current US Google result landscape were observed. It does not supply authenticated Semrush, Ahrefs, or Similarweb volume, KD, CPC, traffic potential, or ranking probability. Those fields remain pending rather than inferred from SERP composition.
