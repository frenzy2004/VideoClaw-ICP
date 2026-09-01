# Task 1 Report — Article schema, parser, and full-library validation

## Status

Complete on `codex/demo-day-seo-campaign`.

## Delivered files

- `package.json` and `pnpm-lock.yaml`: added `gray-matter`, `zod`, `react-markdown`, and `remark-gfm`.
- `lib/content/article-schema.ts`: fixed campaign and editorial enums plus strict typed frontmatter schema.
- `lib/content/articles.ts`: Markdown parsing, raw-HTML rejection, filename/canonical validation, recursive `.md` discovery, duplicate validation, sorted retrieval, fail-closed aggregate errors, and global-plus-article publication gates.
- `lib/content/articles.test.ts`: literal fixture coverage for parsing, schema/path/media/body failures, duplicate IDs/slugs/titles/keywords, private drafts, fail-closed private-mode loading, and a 250-record campaign-total fixture.
- `content/articles/.gitkeep`: canonical article-library root.

## TDD evidence

### Dependency install

Command: `pnpm add gray-matter zod react-markdown remark-gfm`

Result: succeeded; installed `gray-matter 4.0.3`, `zod 4.5.4`, `react-markdown 10.1.0`, and `remark-gfm 4.0.1`.

### RED

Command: `pnpm test lib/content/articles.test.ts`

Result: failed as expected before implementation. Vitest could not resolve `./articles` from `lib/content/articles.test.ts` because the planned loader modules did not yet exist.

During self-review, a second RED regression test showed that `getPublishableArticles()` returned early when global indexing was false and therefore skipped malformed-library validation:

Command: `pnpm test lib/content/articles.test.ts`

Result: 15 tests executed, with `validates the complete library before applying the global indexing gate` failing because no error was thrown.

### GREEN

Command: `pnpm test lib/content/articles.test.ts && pnpm run typecheck && pnpm test`

Result:

- focused article suite: 15/15 tests passed;
- typecheck: `next typegen && tsc --noEmit --incremental false --pretty false` exited successfully;
- full suite: 14/14 test files and 88/88 tests passed.

## Commit

`e665e12 feat: add validated markdown article loader`

## Self-review

- Checked the exact task requirements against the staged patch.
- Ran `git diff --check` successfully before the initial commit and again against the final commit.
- Tightened duplicate tests so each isolates only the intended duplicate field.
- Strengthened the review-draft test by enabling the global indexing flag.
- Added and fixed the fail-closed regression so private-mode publication queries still validate the full library.

## Concerns

No Task 1 blocker remains. `docs/research/campaigns/portfolio-media-platform-article-matrix.md` appeared as an untracked, out-of-scope file during the final verification (timestamp `2026-09-01 12:46:25`); it was not modified or staged.

---

## Fix round 1 — amended contract

### Scope delivered

- Enforced exactly 250 library records and exactly 50 records for each fixed campaign; empty, 249-record, and 250-record campaign-skewed libraries are invalid.
- Added fail-closed filesystem loading for incorrect counts, while retaining aggregated parse/library findings.
- Added keyword-evidence cross-field rules: pending providers require null metrics, null observation, and `pending_paid_provider`; validated or numeric evidence requires an authenticated provider and observation date; draft/review records require `noindex`.
- Changed canonical URLs to exact `/blog/<slug>` paths.
- Required canonical source placement at `content/articles/<campaign_id>/<slug>.md`, including defenses against nested/repeated/similarly named root bypasses.
- Required local single-slash media paths, `rights: owned`, and non-empty alt/caption/credit provenance.
- Replaced the raw-HTML allowlist with rejection of all raw HTML tags, including `<svg/onload=...>`, while preserving Markdown autolinks.
- Normalized case and whitespace for duplicate title and primary-keyword comparison.
- Added required observed Apify SERP evidence and made publication require authenticated validated keyword evidence plus Apify Actor/run/dataset provenance.

### Covering test names

- `returns typed frontmatter, body, and source path from a valid Markdown article`
- `requires observed Apify SERP provenance`
- `requires the SERP query to equal the primary keyword exactly`
- `rejects pending keyword evidence with a non-null pending volume`
- `rejects pending keyword evidence with a pending observation date`
- `rejects pending keyword evidence with a validated pending provider`
- `rejects validated keyword evidence without an authenticated observation`
- `rejects an indexable draft record` / `rejects an indexable review record`
- filename, campaign-directory, nested-directory, repeated-root, and similarly named root rejection tests
- `/blog/<slug>` canonical mismatch test
- external/protocol-relative media, owned-rights, and media-provenance rejection tests
- raw script, iframe, event-handler, slash-separated event-handler, and inert raw-HTML rejection tests
- normalized duplicate title and primary-keyword tests
- empty, 249-record, and campaign-skewed library tests
- complete-library private-gate validation and 249-file fail-closed loader tests
- approved publication test requiring authenticated keyword and observed Apify evidence
- valid synthetic 250-record/50-per-campaign totals test

### RED evidence

Command: `pnpm test lib/content/articles.test.ts`

Output: `16 tests | 11 failed`. The valid amended fixture failed with `canonical_path: Invalid string: must start with "/articles/"` and `Unrecognized key: "serp_evidence"`.

Command: `pnpm test lib/content/articles.test.ts`

Output: `30 tests | 13 failed`. Missing branches were reproduced for exact SERP query matching, pending/validated keyword-evidence cross-fields, draft/review indexing, campaign/nested source paths, protocol-relative media, non-owned rights, and `<svg/onload>`/inert raw HTML.

Command: `pnpm test lib/content/articles.test.ts -t "normalizes case|rejects an empty library|rejects a 249-record library|rejects a 250-record library with skewed"`

Output: `5 failed | 30 skipped`. Both normalized duplicate cases returned no finding; empty, 249-record, and skewed 250-record libraries all returned `valid: true`.

Command: `pnpm test lib/content/articles.test.ts -t "keeps review drafts|validates the complete library|fails closed when the filesystem|publishes only an approved"`

Output: `4 failed | 33 skipped`. The loader ignored the isolated canonical fixture root and validated the repository's zero-record root instead.

Command: `pnpm test lib/content/articles.test.ts -t "rejects a nested path that repeats"`

Output: `1 failed | 37 skipped`; the repeated canonical-root suffix bypass was accepted.

Command: `pnpm test lib/content/articles.test.ts -t "rejects a similarly named non-canonical"`

Output: `1 failed | 38 skipped`; `mycontent/articles/...` was incorrectly accepted as canonical.

### GREEN evidence

Command: `pnpm test lib/content/articles.test.ts -t "article source parsing"`

Output: `23 passed | 7 skipped` after implementing the schema/parser rules.

Command: `pnpm test lib/content/articles.test.ts -t "normalizes case|rejects an empty library|rejects a 249-record library|rejects a 250-record library with skewed"`

Output: `5 passed | 30 skipped` after library normalization/cardinality validation.

Command: `pnpm test lib/content/articles.test.ts -t "keeps review drafts|validates the complete library|fails closed when the filesystem|publishes only an approved"`

Output: `4 passed | 33 skipped` after loader-root injection and publication-gate enforcement.

Final command: `pnpm test lib/content/articles.test.ts && pnpm run typecheck && pnpm test`

Final output:

- focused article suite: `39 passed (39)`;
- typecheck: route types generated and `tsc --noEmit` exited successfully;
- full suite: `15 passed (15)` test files and `118 passed (118)` tests.

A prior attempt at the final command reached `39 passed (39)` focused tests, then typecheck temporarily failed because concurrent untracked `lib/keywords/apify-evidence.test.ts` imported its not-yet-created module. No Task 1 file caused that error; after the concurrent module appeared, the exact final command passed as recorded above.

### Media asset boundary

Task 1 enforces local single-slash media paths, `rights: owned`, and non-empty alt/caption/credit fields. Physical asset existence remains the explicit Task 2 `auditArticle(article, assetExists)` boundary; checking `public/` here would couple canonical parsing to deployment filesystem layout and duplicate the planned audit responsibility.

### Fix-round concerns

No Task 1 blocker remains. Concurrent `docs/research` matrices and `lib/keywords` Apify work were not edited or staged as part of this fix round.

### Fix-round commit

`049a208 fix: enforce amended article library contract`

---

## Fix round 2 — independent re-review bypasses

### Scope delivered

- Made `pending` the only provider compatible with `pending_paid_provider`, a null observation, and all-null proprietary metrics. Named providers now require `validated`, `observed_at`, and at least one non-null volume/difficulty/CPC value; the publication gate repeats the non-null-metric requirement defensively.
- Restricted media sources to safe local files beneath `/media/articles/<matching campaign_id>/`, rejecting root files, traversal, duplicate slashes, query strings, fragments, and another campaign's directory.
- Covered all CommonMark raw HTML declaration forms by rejecting ASCII-letter declarations and CDATA in addition to tags, comments, and processing instructions; URL autolinks remain valid Markdown.
- Restricted `article_id` to exact lowercase `vc-c[1-5]-NNN`, coupled the campaign number to the fixed `campaign_id`, and normalized IDs before duplicate comparison.

### Covering test names

- `rejects a named keyword provider that remains pending`
- `rejects validated named-provider evidence when all proprietary metrics are null`
- `publishes only an approved record with authenticated keyword and observed Apify evidence`
- the six `rejects media src with ...` cases for root, traversal, duplicate slash, query, fragment, and wrong campaign
- `rejects raw CDATA declarations in the Markdown body`
- `rejects raw ENTITY declarations in the Markdown body`
- `preserves Markdown autolinks while rejecting raw HTML`
- the three exact lowercase `article_id` pattern cases
- `requires the article_id campaign number to match campaign_id`
- `normalizes case when comparing duplicate article_id values`

### RED evidence

Command: `pnpm test lib/content/articles.test.ts -t "named keyword provider|all proprietary metrics"`

Output: `2 failed | 39 skipped (41)`. Both named-provider bypasses were accepted without throwing.

Command: `pnpm test lib/content/articles.test.ts -t "rejects media src with"`

Output: `6 failed | 41 skipped (47)`. Every unsafe or cross-campaign media source was accepted.

Command: `pnpm test lib/content/articles.test.ts -t "CDATA|ENTITY|Markdown autolinks"`

Output: `2 failed | 1 passed | 47 skipped (50)`. CDATA and ENTITY declarations were accepted; the autolink control already passed.

Command: `pnpm test lib/content/articles.test.ts -t "article_id pattern|article_id campaign number|case when comparing duplicate article_id"`

Output: `5 failed | 50 skipped (55)`. Uppercase, malformed, out-of-range, and campaign-mismatched IDs parsed, and uppercase bypassed duplicate detection.

### GREEN evidence

Command: `pnpm test lib/content/articles.test.ts -t "named keyword provider|all proprietary metrics|publishes only an approved"`

Output: `3 passed | 38 skipped (41)`.

Command: `pnpm test lib/content/articles.test.ts -t "media src"`

Output: `6 passed | 41 skipped (47)`.

Command: `pnpm test lib/content/articles.test.ts -t "CDATA|ENTITY|Markdown autolinks"`

Output: `3 passed | 47 skipped (50)`.

Command: `pnpm test lib/content/articles.test.ts -t "article_id pattern|article_id campaign number|case when comparing duplicate article_id"`

Output: `5 passed | 50 skipped (55)`.

Command: `pnpm test lib/content/articles.test.ts`

Output: `55 passed (55)`.

### Verification note

The first two project typecheck retries were temporarily blocked by concurrent, out-of-scope Task 2/Task 3 work: first an untracked `lib/seo/article-audit.test.ts` helper had incomplete override typing, then an untracked `app/blog/[slug]/page.test.tsx` preceded its `./page` implementation. Neither file was edited. A subsequent combined run reached a green typecheck but caught the renderer test before its Vitest alias fix. Final settled-tree reruns are recorded below.

Final command: `pnpm test lib/content/articles.test.ts && pnpm run typecheck && pnpm test`

Output:

- focused Task 1 suite: `55 passed (55)`;
- typecheck: route types generated and `tsc --noEmit` exited successfully;
- full suite in that combined run: all `176` runnable tests passed across `17` suites, but the command remained red because concurrent untracked `app/blog/[slug]/page.test.tsx` could not yet resolve its Vitest alias and collected zero tests.

Final full-suite rerun: `pnpm test`

Output: `18 passed (18)` test files and `181 passed (181)` tests.

Final settled-tree typecheck rerun: `pnpm run typecheck`

Output: route types generated and `tsc --noEmit --incremental false --pretty false` exited successfully.

### Self-review

- Rechecked every fix-round finding against the scoped patch and tests.
- Confirmed named-provider requirements are repeated in the publication gate even though invalid records are rejected by the schema first.
- Confirmed media matching occurs after the safe-path grammar, preventing prefix, traversal, delimiter, query, fragment, and campaign-directory bypasses.
- Confirmed the raw-HTML expression covers CommonMark tags, comments, processing instructions, ASCII-letter declarations, and CDATA without matching URL autolinks.
- Confirmed campaign numbering follows the fixed `CAMPAIGN_IDS` order and duplicate IDs are normalized before lookup.
- `git diff --check` passed for all three implementation/test files.

### Fix-round concerns

No Task 1 defect or active verification concern remains. Concurrent matrices, Apify data, renderer, keyword/provider work, and scripts were not edited or staged.

---

## Architecture revision — non-blocking research targets

### Scope delivered

- Added exported `LibraryAdvisory` target data to `LibraryValidationResult`, with `target`, `actual`, and non-negative `shortfall` values.
- Reclassified the 250-record library target as `library.total_target` and each 50-record campaign target as `library.campaign_target` advisories.
- Kept `valid` derived only from blocking `findings`; duplicates remain invalid while target misses and target excesses are transparent but non-blocking.
- Kept `getAllArticles` fail-closed for parse, schema, canonical path, raw HTML, evidence, read, and duplicate findings while allowing valid incremental libraries to load.
- Kept every per-article publication gate and the exact global indexing flag; one fully gated article can publish from a one-record library.

### Covering test names

- `reports an empty library as valid with transparent target shortfalls`
- `reports a one-record library as valid with target shortfalls`
- `reports a 249-record library as valid with only its remaining target shortfalls`
- `reports a skewed 250-record library as valid with campaign target advisories`
- `reports every campaign total for a valid synthetic 250-record library`
- `loads an incremental filesystem library containing 0 valid records`
- `loads an incremental filesystem library containing 1 valid records`
- `loads an incremental filesystem library containing 249 valid records`
- `fails closed on malformed input before applying the global indexing gate`
- `publishes one fully gated article from an incremental library only when global indexing is enabled`
- duplicate-field tests now also assert that duplicate findings make the result invalid.

### RED evidence

Command: `pnpm test lib/content/articles.test.ts -t "target shortfalls|remaining target|campaign target advisories|incremental filesystem|incremental library|malformed input"`

Output: `8 failed | 1 passed | 49 skipped (58)`. Empty, one-record, 249-record, and skewed libraries remained invalid; filesystem libraries with 0, 1, and 249 records threw count errors; one gated incremental article could not publish. The malformed-input control passed, confirming integrity validation remained active.

A preliminary invocation stopped on a test-only delimiter typo and was corrected before the valid RED above; no production code was changed before the behavioral failures were observed.

### GREEN evidence

Command: `pnpm test lib/content/articles.test.ts -t "target shortfalls|remaining target|campaign target advisories|incremental filesystem|incremental library|malformed input"`

Output: `9 passed | 49 skipped (58)`.

Command: `pnpm test lib/content/articles.test.ts`

Output: `58 passed (58)`.

Project typecheck command: `pnpm run typecheck`

Output: route types generated and `tsc --noEmit --incremental false --pretty false` exited successfully.

Final combined verification: `pnpm test lib/content/articles.test.ts && pnpm run typecheck && pnpm test`

Output: focused Task 1 `58 passed (58)`; route types generated and TypeScript exited successfully; full suite `19 passed (19)` test files and `210 passed (210)` tests. An earlier full-suite invocation caught an out-of-scope renderer cycle between its failing tests and implementation; no renderer file was edited by Task 1.

### Self-review

- Confirmed `getAllArticles` still aggregates only blocking parse/read/library findings and does not silently discard any integrity error.
- Confirmed advisory ordering is deterministic: total target first, then fixed campaign order.
- Confirmed target excesses remain visible with their actual value and a zero shortfall, while target misses expose the exact shortfall.
- Confirmed duplicate tests fail if `valid` stops reflecting blocking findings.
- Confirmed the incremental publication test fails if either the article gates or global indexing gate is removed.
- Confirmed the mutation of count advisories back into findings would fail unit, filesystem, and publication tests.
- Scoped `git diff --check` passed.

### Concerns

No Task 1 concern. Concurrent content-map, renderer, Apify, matrix, data, and scripts work was not edited.
