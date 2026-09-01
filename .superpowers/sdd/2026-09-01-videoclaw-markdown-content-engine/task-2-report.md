# Task 2 Report — Deterministic editorial QA and keyword-provider contract

## Status

Implementation complete on `codex/demo-day-seo-campaign` within the Task 2 file boundary.

## Delivered

- `lib/seo/article-audit.ts`: deterministic `VideoClaw editorial QA` category scoring for technical, attribution, evidence, media, and keyword checks; exported thresholds and blocking codes; injected asset-existence boundary; fail-closed publication predicate.
- `lib/seo/article-audit.test.ts`: literal `ArticleRecord` fixture coverage for all requested thresholds, provenance/media checks, pending keyword evidence, and the global indexing gate.
- `lib/keywords/provider.ts`: provider-neutral import contract, provider registry, null-preserving normalization, US-only validation, metric-range validation, and pending/named-provider cross-field rules.
- `lib/keywords/provider.test.ts`: literal import fixtures for successful Semrush/Ahrefs normalization and every requested rejection state.
- `docs/research/2026-09-01-keyword-provider-comparison.md`: official-source comparison with facts separated from the VideoClaw recommendation: Semrush first, Ahrefs alternative, Similarweb supplementary, and Google Search Console post-publication.

## TDD evidence

### RED

Command:

`pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts`

Result: failed as expected. Vitest could not resolve `./article-audit` or `./provider` because neither production module existed.

### GREEN

Command:

`pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts`

Result: 2/2 test files and 36/36 tests passed.

Command:

`pnpm run typecheck`

Result: Next route type generation and `tsc --noEmit --incremental false` exited successfully.

The first typecheck exposed a test-helper intersection-type bug, which was corrected. A later retry was temporarily blocked by concurrent Task 3's `page.test.tsx` importing its not-yet-created `page.tsx`; Task 2 files were not changed to work around that concurrent state. After Task 3's module appeared, the exact typecheck command passed.

## Self-review

- Rechecked every Task 2 acceptance item against the implementation and tests.
- Verified every category score is exactly `Math.round(passedChecks / totalChecks * 100)` and exposes the numerator and denominator.
- Confirmed a named provider cannot become validated without a date and at least one observed numeric metric; absent optional metrics remain `null`.
- Confirmed pending rows reject any numeric value, including zero, and an observation date.
- Confirmed the auditor independently rejects the named-provider/null-metric state still representable by the current Task 1 type.
- Confirmed media paths are campaign-scoped under `/media/articles/<campaign>/`, reject traversal/query/fragment components, and use the injected existence check.
- Confirmed all provider research claims link to current official documentation and no access, credential, subscription, price, or metric is invented.
- Ran scoped ESLint and whitespace checks without findings.

## Concerns

- No authenticated Semrush, Ahrefs, or Similarweb access was supplied or tested. Article metrics must remain `pending_paid_provider` until a real provider import is verified.
- Google Search Console uses a separate post-publication shape for clicks, impressions, CTR, and average position; those fields are intentionally rejected by the proprietary keyword adapter and must not be relabeled as volume, difficulty, or CPC.
- Concurrent Task 1 and Task 3 work remained outside this task's edits and commit scope.

---

## Fix round 1 — independent review

### Review findings resolved

- `isArticlePublishable` no longer trusts caller-supplied blocker arrays. Audits are bound privately to the exact `ArticleRecord` and asset resolver that produced them; publication rejects fabricated and cross-record audits, then recomputes every current article check so body, Apify, keyword, and media changes cannot use stale results.
- `normalizeKeywordImport` now excludes and explicitly rejects GSC. `SearchConsoleObservation` and `normalizeSearchConsoleImport` contain only post-publication clicks, impressions, CTR, and average position and reject proprietary fields.
- Markdown analysis strips backtick/tilde fenced code, indented code, and inline code before heading, word, and citation checks. Extracted citations distinguish links from image syntax and must match a declared source URL.
- Media QA accepts injected `{ exists, width, height }` metadata and blocks absent/non-positive dimensions. Existing controlled image resolvers remain compatible because the renderer declares 1200 × 675; videos require measured metadata.
- The advisory path is now exercised by `attribution.discovery_context` when an observed SERP has no PAA, related-query, or autocomplete context.

### TDD evidence

RED command:

`pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts`

Result: 14 expected failures across forged/stale audit gates, cross-record binding, fenced Markdown, image citations, dimensions, advisory handling, and GSC separation. The fixture helper was deep-cloned after the mutation tests exposed shared nested state.

GREEN and integration commands:

`pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts && pnpm test && pnpm run typecheck && pnpm run lint`

Result:

- focused Task 2 tests: 52/52 passed;
- full suite: 19/19 files and 210/210 tests passed;
- Next route type generation and TypeScript typecheck passed;
- repository ESLint passed.

The first full-suite attempt had one expected integration regression because a content-map test asserted the existing provider-blocker wording. The logic remained stricter while the compatible user-facing wording was restored; the complete command then passed.

### Fix-round concerns

- A boolean existence resolver remains supported only for controlled images, whose renderer declares 1200 × 675. Video publication stays blocked unless the resolver returns measured positive dimensions.
- The private audit binding is intentionally process-local. Serialized or reconstructed audit objects cannot authorize publication; callers must invoke `auditArticle` in the same process before `isArticlePublishable`.
- No authenticated paid-provider or Search Console property was supplied or called.
