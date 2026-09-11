# Worker completion audit

Scope remains worker PR #1 into `seo-campaign`. No production/main changes,
lander/PR #55 edits, publication, generated lander PRs, deployments or schedule
activation are authorized by this checkpoint.

## Fresh run outcomes

- `transcription-live-proof-2026-09-12`: eight organic results; rejected before
  source inspection or OpenAI because the candidate failed product relevance.
  The candidate and failed outcome were retained, not renamed or reset.
- `aspect-ratio-live-proof-2026-09-12`: eight organic results, observed PAA,
  automatically retrieved source bodies and successful source relevance review.
  FAQ preparation failed because one model-selected excerpt included a heading
  before the stored body boundary. No draft or native validation occurred.
- Google provenance for the aspect-ratio attempt:
  `D401264gQH8uR8xcf` / `GiZyg1dvkA9jZv7Da`.
- Current retained local history: 41 runs, 66 failure records, no successful
  fresh pilot. No historical failure is counted as success.

## FAQ input correction

The failed excerpt started with the 17-character heading `Change the ratio `.
It matched the full fact, but not the body after `bodyStart`. The gate correctly
rejected it. FAQ preparation now sends `headingContext` and `bodyText` separately,
with the boundary computed in code. Full stored facts, context hashes, exact
body-only receipt checks and independent semantic review remain unchanged.

A test-first Unicode-boundary regression reproduced the old input shape. Mixed
heading/body excerpts still fail. The focused FAQ/drafting/offline integration
suite passes 301 tests. Independent read-only review found no actionable issues.

A separate one-call live FAQ diagnostic passed using the unchanged captured
research and PAA pool. State, original receipts and FAQ implementation stayed
unchanged during that diagnostic. It is **component verification, not a fresh
worker success**. An earlier diagnostic recorder rejected response headers;
that failed diagnostic is retained separately and is not counted as a pass.

## Remaining full-worker audit

The current artifact milestone still requires a fresh uninterrupted research →
draft → critique/one repair → native QA → durable review-artifact acknowledgement.
Do not substitute saved-artifact or component results for it.

Additional software requirements identified by source inspection:

1. Defer viable topics excluded by the ten-deep-check cap; do not mark them
   completed and permanently remove them from future runs.
2. Persist ordinary shallow failures as terminal run records, retain research
   failure history, and make replay of a recorded run perform no paid work.
3. Retain source-body hashes and critique/repair acceptance receipts in the
   standard Actions artifact path, not only the local diagnostic runner.
4. Provide a tested history-preserving handoff of the diagnostic state. Active
   one-off grants and their global fresh-history restrictions currently prevent
   simply copying that state into ordinary future Actions runs. Do not delete
   failed history or bypass grants as a migration shortcut.

The first two items are corrected in this checkpoint. Nine added worker cases
cover deferred-topic restart, ordinary shallow-failure replay, and durable
research failure history. The worker-focused suite passes 120 tests. The combined
suite passes **2,834 tests across 63 files**, zero failures/skips, plus lint,
typecheck and build. Existing Vinext dynamic-import warnings remain. Items 3–4
remain worker-owned work, not reasons to request credentials prematurely.

Independent review of the two worker files found no actionable regressions.
The five offline integration cases also passed with the lander path explicitly
configured. Those use its article contract in a fixture package, not the full
production application. Separately, the unchanged saved captions article passed
the actual lander's `check:blog`, lint and full build in an isolated clone at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. Its integrity check passed. Neither
result is a fresh live-worker proof.

## External rollout dependencies

Unattended private-repository access, paid keyword-provider credentials, GitHub
App installation, team article approval and explicit schedule approval remain
separate dependencies. DataForSEO is not connected; no demand metrics are
invented from Apify SERPs. The schedule remains disabled. A successful local
artifact will not by itself prove unattended publication or the full rollout.
