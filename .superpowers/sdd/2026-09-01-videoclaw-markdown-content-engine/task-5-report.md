# Task 5 Report — Live US Apify candidate and SERP evidence

## Status

Review fixes implemented and verified.

## Delivered

- `lib/keywords/apify-evidence.mjs`: exact US/en first-page normalization, result-type classification, retry selection, transparent observed-evidence scoring that excludes editorial relevance, and primary-to-secondary SERP fallback when an observed primary contains no organic competitors.
- `lib/keywords/apify-evidence.test.ts`: literal Actor fixtures, wrong-country/wrong-language/provenance failures, no-proprietary-metric scoring checks, run/dataset mismatch coverage, all-five-matrix extraction, retry selection, fallback labeling, and the committed 250-record intent-review boundary.
- `scripts/research/collect-apify-evidence.mjs`: runtime-token-only collection/resume CLI with redacted errors, verified run/default-dataset lineage, matrix parsing, candidate accounting, fail-closed organic-evidence selection, explicit editorial intent-review status, and manifest generation.
- `data/research/apify/run-manifest.json`: Actor, run, dataset, locale, device, observation time, and query-count provenance.
- Five normalized campaign evidence files.

## Observed totals

- Five campaigns.
- 200 unique matrix candidates per campaign; 1,000 total.
- 50 SERP-observed research-shortlist entries per campaign; 250 total and 250 unique selected queries.
- 1,121 normalized SERP observations across base, correction, and retry runs.
- 2,160 organic result records attached to the 250 selections.
- 225 matrix primaries retained; 25 empty or AI-overview-only primaries replaced with an observed secondary from the same article specification.
- Zero selected records with an empty organic result set.
- Ten manually reviewed Demo Day records are `approved_for_mvp_draft`; the other 240 remain `pending_editorial_intent_review`.
- All volume, difficulty, and CPC values remain null with provider `pending`.

## Research corrections

- Autocomplete alone was sparse and noisy, so it was retained as discovery evidence rather than treated as demand volume.
- Broad `demo day video` results included unrelated event recordings and social pages; the query was not promoted merely because it was a seed.
- Official Google SERP runs sometimes returned an AI Overview but no organic results. Those responses remain auditable in the evidence file but cannot qualify an article. The collector prefers a successful retry and otherwise replaces the primary with a researched secondary that has first-page organic competitors.
- Automatic fallback selection uses observed SERP-feature density only. It is explicitly pending editorial intent review and does not assert ICP fit.
- Editorial relevance is never auto-filled or included in `evidenceScore`. The ten MVP approvals carry concise manual rationales; every score keeps numeric relevance null.
- Explicit resumed run/dataset pairs must match each fetched run's `defaultDatasetId` before provenance is attributed.
- Two article specifications were refined from new US autocomplete evidence after every original candidate returned no organic competitors: `30 60 90 day marketing plan` and `how to make a product demo video`.

## TDD and verification evidence

Review-fix RED produced nine expected failures: two wrong-language acceptances, three relevance/scoring failures, two run/dataset-lineage failures, one misleading fallback label, and one missing committed-data intent-review contract. After the code changes, only the mechanical data migration remained red. The migrated focused suite passes 20/20 tests.

Final checks before commit:

```text
pnpm test lib/keywords/apify-evidence.test.ts — 20/20 passed
node --check lib/keywords/apify-evidence.mjs — passed
node --check scripts/research/collect-apify-evidence.mjs — passed
pnpm run typecheck — passed
git diff --check — passed
credential scan for the exact runtime token — passed, zero matches
```

## Boundary

This is a SERP-observed research shortlist, not demand validation. Apify proves that a query and its current US Google result landscape were observed. It does not prove that all 250 queries match their intended ICP, and it does not supply authenticated Semrush, Ahrefs, or Similarweb volume, KD, CPC, traffic potential, or ranking probability. Editorial intent fit remains pending for 240 records, and every proprietary demand field remains pending rather than inferred from SERP composition.
