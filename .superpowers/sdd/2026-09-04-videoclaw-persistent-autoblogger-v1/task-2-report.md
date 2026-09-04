# Task 2 report — Research and keyword adapters

## Implementation

Added dependency-injected research boundaries under `lib/autoblogger/` while consuming the Task 1 domain and policy exports:

- `keyword-providers.ts` defines `KeywordProvider.enrich()` and adapters for explicit `pending`, Semrush, and Ahrefs modes. Semrush uses `GET https://api.semrush.com/apis/v4/keywords/v1/metrics`; Ahrefs uses `GET https://api.ahrefs.com/v3/keywords-explorer/overview`. Both use injected HTTP transport, authenticated headers, fixture-backed response validation, cents-to-USD CPC normalization, Task 1 `KeywordMetricsSchema`, observation timestamps, provider endpoint/request/source provenance, and a scheduled-mode completeness gate.
- `apify-client.ts` implements the Apify API v2 actor/run/dataset boundary through the same injected HTTP transport. It does not read credentials from globals and redacts supplied and recognizable credential patterns from failures.
- `research.ts` batches US/en autocomplete discovery over at most 50 candidates, directly calls Task 1 `stageOpportunitiesForDeepInspection()`, and defensively refuses scan/deep counts above 50/10. It refreshes at most 10 first-page US/en desktop SERPs, uses bounded actor execution, and returns exact Actor, run, dataset, and observation provenance beside Task 1 `EvidenceBundle` values.
- `sources.ts` validates HTTP(S) targets before every request and after every redirect. It rejects localhost, private, carrier-grade NAT, link-local, multicast, and unsafe IPv6 targets, including private DNS answers; limits redirects, bytes, and end-to-end time including DNS; does not return page bodies; and requires two distinct reachable sources with at least one authoritative source.
- Source authority is entirely caller supplied through `authoritativeDomains` and `primarySourceUrls`. A primary source makes only its own domain authoritative; there is no embedded subjective authority allowlist.
- PAA extraction deduplicates questions, requires keyword-token relevance, and emits exactly three questions for both the SERP and FAQ evidence fields.
- `http.ts` supplies the shared request/timeout/redaction boundary. Timeout rejection is enforced independently of whether an injected transport honors `AbortSignal`.

Default safety bounds are three source redirects, 1,000,000 response bytes, and 5 seconds per source check; provider HTTP calls use a 10-second timeout. Apify actor execution defaults to 30 polls, three attempts for transient poll/dataset reads, a 1-second polling interval, and a 60-second run timeout. The autocomplete Actor input also retains `maxRequestRetries: 3`.

## Provider fixture authority

- Semrush fixture and request shape follow the official Keyword Reports API v4 documentation: `https://developer.semrush.com/api/v4/seo/keyword-reports/`.
- Ahrefs fixture and request shape follow the official Keywords Explorer API v3 overview documentation: `https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-overview`.
- No test makes a live provider, Apify, DNS, or source request, and no credential is required.

## RED and GREEN evidence

| Cycle | Observed RED | Observed GREEN |
| --- | --- | --- |
| Keyword providers | `keyword-providers.test.ts` failed to resolve missing `./keyword-providers`. | 4/4 tests passed after the pending, Semrush v4, and Ahrefs v3 adapters were added. |
| Safe sources | `sources.test.ts` failed to resolve missing `./sources`. | Initial source boundary passed 6/6 tests. |
| Apify client and staged research | `apify-client.test.ts` and `research.test.ts` both failed to resolve their missing modules. | 2 Apify client tests and 4 researcher tests passed. |
| Abort-ignoring transport timeout | A 5 ms source check incorrectly resolved successfully after the transport ignored abort and returned at 25 ms. | Focused regression passed after the shared HTTP helper raced transport completion against timeout rejection. |
| Pending DNS timeout | A 5 ms source check remained pending after 20 ms when DNS never completed. | Focused regression passed after DNS resolution was raced against the remaining end-to-end source deadline. |
| Legacy compatibility | Combined focused run included the existing keyword import and Apify parser/collector suites. | 7 files and 76 tests passed before the final timeout regression was added; final full suite covers all 270 tests. |

## Verification

- `npm test` — 28 files, 270 tests passed.
- `npm run typecheck` — Next route generation and TypeScript completed successfully.
- `npm run lint` — completed with zero warnings or errors.
- `git diff --check` — completed successfully.

## Files changed

- Added `lib/autoblogger/http.ts`.
- Added `lib/autoblogger/apify-client.ts` and `apify-client.test.ts`.
- Added `lib/autoblogger/keyword-providers.ts` and `keyword-providers.test.ts`.
- Added `lib/autoblogger/research.ts` and `research.test.ts`.
- Added `lib/autoblogger/sources.ts` and `sources.test.ts`.
- Added Semrush and Ahrefs JSON response fixtures under `lib/autoblogger/fixtures/`.
- Updated `lib/autoblogger/index.ts` to export the Task 2 boundaries.
- Generalized the existing pure `stageOpportunitiesForDeepInspection()` type parameter so the researcher can call the committed Task 1 policy directly before evidence exists; runtime behavior is unchanged.
- Added this report.

## Self-review

- Confirmed the researcher calls `stageOpportunitiesForDeepInspection()` directly and separately checks `RUN_LIMITS.maxCandidatesScanned` and `RUN_LIMITS.maxDeepInspections`.
- Confirmed research inputs are fixed to US/en, desktop, first page, and HTML persistence is disabled in the new SERP run input.
- Confirmed run and default-dataset IDs come from the completed run returned by the injected Apify boundary and are retained exactly in provenance.
- Confirmed polling, retry attempts, HTTP requests, DNS resolution, redirects, and response sizes all have explicit bounds.
- Confirmed source responses are reduced to URL/status/reachability/authority metadata and body text cannot enter returned or persisted evidence.
- Confirmed authority derives only from caller configuration and final redirect destinations are reclassified.
- Confirmed provider results are parsed through Task 1 `KeywordMetricsSchema`; no duplicate keyword metrics schema was introduced.
- Confirmed scheduled mode rejects pending or null volume/difficulty, while manual pilot mode retains explicit pending metrics.
- Confirmed `lib/keywords/apify-evidence.mjs`, `lib/keywords/provider.ts`, and `scripts/research/collect-apify-evidence.mjs` were not changed and their existing tests pass.
- Confirmed the pre-existing untracked `package-lock.json` remains untracked and is excluded from the commit.

## Concerns

- Semrush labels Keyword Reports API v4 as Early Access, so its fixture parser and boundary may need an explicit update if Semrush changes the response contract.
- Task 5 must provide production `HttpTransport` and DNS resolver implementations plus the campaign-specific authority/primary-source configuration. Task 2 intentionally provides no implicit live transport or embedded authority list.
- PAA relevance is a deterministic lexical gate. It prevents wholly unrelated questions but does not replace the independent editorial/critique checks planned for Task 3.

## Fix round 1 — Important findings

### Implementation

- Added a dedicated `SourceHttpTransport` contract. Source requests now require `redirect: 'manual'`, the DNS-validated `allowedPeerAddresses`, and `maxResponseBytes`. Responses must expose the actual connected `peerAddress`, the response URL and redirect state, and an incremental `AsyncIterable<Uint8Array>` body. The checker rejects automatic-follow responses and peers outside the validated address set, passes the byte cap to the transport, independently counts streamed bytes, and closes stream iteration when it stops.
- Source DNS, redirects, transport completion, and stream iteration remain inside one source deadline. The checker re-resolves each manual redirect destination and verifies the connected peer for every hop, preventing a redirect or DNS-rebinding hop from bypassing private-address checks.
- `runApifyActor()` now races the remaining run deadline against `startActor`, every individual `getRun` retry, polling sleep, and each dataset retry. A hanging injected dependency cannot keep the caller beyond the configured run timeout.
- Source URLs are canonicalized as HTTP resources with fragments removed before requests, returned evidence, and distinctness checks.
- Source selection treats each unsafe, unreachable, timed-out, or malformed candidate as an individual failure, continues through later candidates, and applies the two-reachable/one-authoritative gate only after exhausting the candidate list.
- PAA relevance now excludes generic `video`/`videos` and `startup`/`startups` terms and requires overlap with at least two meaningful keyword tokens when two are available.

### RED and GREEN evidence

| Finding | RED command and observed output | GREEN command and observed output |
| --- | --- | --- |
| Manual redirects, validated peer, streamed byte cap | `npm test -- lib/autoblogger/sources.test.ts -t "transport contract"` — 3 tests failed because auto-follow, private peer mismatch, and a two-chunk six-byte response all resolved successfully. | Same command — 3 tests passed, 8 skipped. `npm test -- lib/autoblogger/sources.test.ts` then passed 11/11 before the later source-selection regressions were added. |
| End-to-end Apify deadline | `npm test -- lib/autoblogger/research.test.ts -t "hanging"` — 4 tests failed because delayed start, poll, sleep, and dataset dependencies all resolved after a 5 ms run timeout. | `npm test -- lib/autoblogger/research.test.ts -t "hanging"` — 4 tests passed, 4 skipped; full researcher file passed 8/8 before the later PAA regression was added. |
| Fragment-safe distinctness and continue-after-failure | `npm test -- lib/autoblogger/sources.test.ts -t "canonicalizes|continues"` — 2 tests failed: fragment variants produced two sources and a private first candidate aborted selection. | Same command — 2 tests passed, 11 skipped. |
| Stronger PAA relevance | `npm test -- lib/autoblogger/research.test.ts -t "generic video or startup"` — 1 test failed because three unrelated questions sharing only generic terms were accepted. | Same command — 1 test passed, 8 skipped. |
| Combined affected files | After the individual cycles, `npm test -- lib/autoblogger/sources.test.ts lib/autoblogger/research.test.ts` passed 22/22. | Final source and researcher totals are 13/13 and 9/9 respectively. |

### Verification

- Focused Task 2: `npm test -- lib/autoblogger/apify-client.test.ts lib/autoblogger/keyword-providers.test.ts lib/autoblogger/research.test.ts lib/autoblogger/sources.test.ts` — 4 files, 28 tests passed.
- `npm run typecheck` — Next route generation and TypeScript completed successfully.
- `npm run lint` — completed with zero warnings or errors.
- `npm test` — 28 files, 280 tests passed.
- `git diff --check` — completed successfully before staging.

### Self-review

- Confirmed the generic provider/Apify HTTP boundary is unchanged; only safe source retrieval requires the stronger source-specific subtype.
- Confirmed source HTTP cannot silently auto-follow under the contract, each hop gets a fresh DNS set, and the reported peer must be public and belong to that set.
- Confirmed the checker does not materialize body content and stops as soon as streamed bytes exceed the cap; no body bytes enter `CheckedSource` or evidence.
- Confirmed URL fragments never reach HTTP requests or distinctness keys.
- Confirmed one failed source cannot prevent later candidates from satisfying the existing two-source/authority requirement.
- Confirmed every blocking Apify dependency and every retry attempt receives only the deadline remaining from the original actor start.
- Confirmed the stronger PAA mutation still permits the existing relevant demo-day questions and staged 50/10 researcher fixture.
- Confirmed no live network calls, credentials, legacy parser changes, collector changes, or dependency additions were introduced.
- Confirmed the pre-existing untracked `package-lock.json` remains excluded.

### Fix-round concerns

- Task 5's production source transport must implement the explicit manual-redirect, address-pinning/peer-reporting, streaming, cancellation, and byte-cap contract. Task 2 now rejects responses that disclose auto-follow or a mismatched peer and independently enforces the streamed-byte limit.
