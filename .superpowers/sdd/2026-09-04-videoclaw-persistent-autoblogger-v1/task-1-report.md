# Task 1 report — Incremental opportunity domain and state

## Implementation

Added a focused `lib/autoblogger/` domain foundation:

- `domain.ts` provides version-1 Zod contracts for `Candidate`, `EvidenceBundle`, `KeywordMetrics`, `DraftBundle`, and `RunRecord`; canonical keyword/title/slug/intent normalization; and stable identity fingerprints.
- `matrices.ts` ingests each checked-in matrix layout currently in use: wide article tables, per-field tables, and labeled article sections. It has no required matrix or portfolio count and rejects normalized keyword/title/slug collisions during incremental intake.
- `policies.ts` rejects duplicate candidates from backlog, persisted state, lander inventory, and open PR inventory; evaluates evidence/mode eligibility; scores and deterministically selects candidates; enforces the 50 scan, 10 deep-inspection, 3-draft, 2-per-ICP, and 1-manual-pilot limits.
- `state.ts` supplies a compact fingerprint-only persistent state model with legal transitions and idempotent repeated events/run records.
- `DraftBundleSchema` deliberately validates only the worker envelope and opaque generation DTO. It has no article-publication rules; the lander-native validation remains the final authority.

## Tests and results

- Focused autoblogger suite: 4 files, 20 tests passed.
- Full suite: 24 files, 248 tests passed (`npm test`).
- Type check passed (`npm run typecheck`).
- Lint passed (`npm run lint`).

## RED and GREEN evidence

| Cycle | RED evidence | GREEN evidence |
| --- | --- | --- |
| Canonical identity | `domain.test.ts` could not resolve `./domain`. | After the minimal normalizers/fingerprints: 1/1 passing. |
| Versioned contracts | `CandidateSchema` was undefined and `.parse` failed. | Candidate, evidence, metrics, permissive draft envelope, and run record: 2/2 passing. |
| Matrix ingestion | `matrices.test.ts` could not resolve `./matrices`. | Three matrix layouts, collision rejection, and all checked-in campaign matrices: 3/3 passing. |
| Duplicate policy | `policies.test.ts` could not resolve `./policies`. | Backlog/state/lander/open-PR collisions: 4 passing. |
| Eligibility policy | `evaluateEligibility is not a function`; later an under-filled PAA case incorrectly returned eligible. | Missing suggestion/SERP/PAA/source/authority/FAQ signals and pending/incomplete scheduled metrics: 8 passing. |
| Deterministic ranking | Tie-break mutation returned input order `vc-c2-011, vc-c2-010` instead of canonical order. | Restored canonical fingerprint tie-break; policies suite: 14/14 passing. |
| Persistent state | `state.test.ts` could not resolve `./state`. | Legal transitions, idempotent reruns, and illegal-transition/run-collision rejection: 3/3 passing. |
| Type contracts | `npm run typecheck` reported missing `CampaignId` and a raw parser type accidentally requiring parsed `Candidate` fields. | Exported `CampaignId` and separated raw parser input from parsed `Candidate`; type check passed. |

## Files changed

- Added `lib/autoblogger/domain.ts` and `domain.test.ts`.
- Added `lib/autoblogger/matrices.ts` and `matrices.test.ts`.
- Added `lib/autoblogger/policies.ts` and `policies.test.ts`.
- Added `lib/autoblogger/state.ts`, `state.test.ts`, and `index.ts`.
- Added this report and the Task 1 implementation plan in the SDD folder.

## Self-review

- Confirmed all production changes are confined to `lib/autoblogger/`; no legacy collector, lander repo, production branch, or PR #55 was touched.
- Confirmed `DraftBundle` does not reimplement the lander publication schema.
- Confirmed no exact-50 or exact-250 input assumption; 50 is only an explicit maximum scan limit and the integration test asserts variable-sized matrix intake.
- Confirmed state contains only fingerprints, statuses, run IDs, timestamps, and compact run records—not raw pages or model output.
- Confirmed scheduled mode rejects `pending`, null-volume, and null-difficulty metrics, while manual pilot permits pending metrics and limits output to one selected artifact.

## Concerns

- `icp` is initialized from `campaignId` during matrix ingestion because the current matrices are campaign-scoped. Future sources can supply a more granular ICP string directly through `CandidateSchema` without changing selection policy.
- Source reachability and PAA relevance are represented by normalized evidence fields here; Task 2 owns network collection, safe-source verification, and relevance extraction.

## Fix round 1 — blocking findings

### Implementation

- Candidate state events now carry and persist run mode. A manual-pilot event cannot transition to `pr_opened`, and an existing candidate cannot switch modes mid-run.
- `recordRun` now rejects a `manual_pilot` record with `pr_opened` status.
- `selectOpportunities` now always passes its candidate pool through `stageOpportunitiesForDeepInspection`, which applies the 50-candidate scan cap and the 10-item deep-inspection cap before eligibility or scoring can run.
- `evaluateEligibility` now compares `EvidenceBundle.candidateFingerprint` with the canonical fingerprint of its `Candidate` and rejects mismatches.

### Regression tests and RED/GREEN evidence

| Finding | Test file | RED command and observed output | GREEN command and observed output |
| --- | --- | --- | --- |
| Manual pilot may reach a PR state | `lib/autoblogger/state.test.ts` | `npm test -- lib/autoblogger/state.test.ts` — `refuses a manual-pilot transition to an opened pull request` failed: expected the function to throw, received no error. A separate run then showed `refuses to record a manual-pilot pull-request run` failing for the same reason. | `npm test -- lib/autoblogger/state.test.ts` — 5/5 tests passed after mode-aware transition and run guards. |
| Deep cap is disconnected | `lib/autoblogger/policies.test.ts` | `npm test -- lib/autoblogger/policies.test.ts` — staged-candidate regression selected `vc-c2-011` (the eleventh item) ahead of capped candidates. | `npm test -- lib/autoblogger/policies.test.ts` — 15/15 tests passed after selection was routed through `stageOpportunitiesForDeepInspection`. |
| Evidence can belong to another candidate | `lib/autoblogger/policies.test.ts` | `npm test -- lib/autoblogger/policies.test.ts` — mismatched evidence returned `{ eligible: true, reasons: [] }` instead of `evidence_candidate_mismatch`. | `npm test -- lib/autoblogger/policies.test.ts lib/autoblogger/state.test.ts` — 21/21 tests passed after canonical fingerprint comparison. |

### Verification

- `npm test -- lib/autoblogger/domain.test.ts lib/autoblogger/matrices.test.ts lib/autoblogger/policies.test.ts lib/autoblogger/state.test.ts` — 4 files, 26 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 24 files, 252 tests passed.

### Fix-round self-review

- Both manual-pilot PR rejection boundaries are guarded: event/state progression and compact run persistence.
- The only production selection path now stages at most ten deep-evidence opportunities before evaluating eligibility; the regression places the highest-scored candidate eleventh and proves it is excluded.
- Eligibility now refuses cross-candidate evidence before considering any evidence-quality signal.
- Scope remains limited to `lib/autoblogger/policies.ts`, `lib/autoblogger/state.ts`, and their regression tests.

### Fix-round concerns

- Task 2 must route its live researcher through `stageOpportunitiesForDeepInspection`; the Task 1 selection policy already enforces the same cap defensively at selection time.
