# DataForSEO adapter checkpoint

## Result

The worker accepts `KEYWORD_PROVIDER=dataforseo` using runtime-only
`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`. CLI validation, runtime selection,
prepare-only Actions credentials and persistent provenance are wired.

**This is offline software verification, not a live provider run or demand
validation.** No DataForSEO credentials are connected. Apify remains responsible
for live SERPs, Google questions and source discovery.

## Provider mapping

The adapter uses the [official Google Keyword Overview contract](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/):

- One US (`2840`), English (`en`) keyword per request.
- Volume comes from `keyword_info.search_volume`.
- Organic difficulty comes from `keyword_properties.keyword_difficulty`, never
  advertising competition.
- `keyword_info.cpc` is already USD; no cents conversion.
- Task ID, retrieval time and source update time are retained as provenance.
- Missing data stays unknown; scheduled selection requires volume and difficulty.

Requests reject empty or oversized queries and do not remove punctuation to
force a returned keyword match. Provider task failures, absent rows, mismatched
locale/query and invalid metrics fail closed. Clickstream and SERP add-ons are
disabled. The adapter makes one request per enrichment with no inline retry.
The existing worker can retry failed enrichment on a later approved run under its
candidate-attempt cap; a timeout may already have been billed. This integration
does not change that policy or start another run.

## Verification

- New adapter tests: **30 passing**, including persistent-state round trip.
- CLI tests: **31 passing**; runtime integration tests: **12 passing**.
- Complete suite: **2,988 tests across 69 files**, zero failures or skips.
- Lint, typecheck and worker build: passed. Existing Vinext dynamic-import
  warnings remain; no deployment was performed.
- Runtime test reaches the actual selected provider with a controlled transport;
  an HTTP failure does not fall back to pending or expose Basic credentials.
- Invalid credentials fail before work. Login, password and Basic encoding are
  excluded from audit/error artifacts. Publish mode rejects these credentials.

The serialized request test caught and corrected an object-versus-JSON transport
mismatch before release. All final checks above ran after that correction.
Synthetic metrics exist only in test fixtures, not in article research records.

Independent review checked the provider boundary and flagged cross-run retries;
the distinction above is explicit. Bounded cross-run retries are existing worker
behavior, not a new automatic-retry loop in this adapter.

## Unchanged boundaries and remaining dependencies

The earlier [fresh article proof](FRESH-WORKER-PROOF-2026-09-12.md) remains the
live end-to-end evidence, including native lander QA. This adapter change does
not change the lander frontmatter contract or repeat that paid pilot.

`KEYWORD_PROVIDER` still defaults to `pending`; `AUTOBLOG_SCHEDULE_ENABLED` is
still `false`. Only worker PR #1 changes. Original lander files, PR #55,
production, saved run history and the consumed pilot are untouched.

Before unattended operation: connect paid-provider credentials and scoped lander
read access. Cross-repository draft PRs also require the approved GitHub App and
lander rollout boundary. Human approvals remain mandatory; there is no automatic
merge, publication, deployment or schedule activation.
