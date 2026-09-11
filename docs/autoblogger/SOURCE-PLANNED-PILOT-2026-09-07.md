# Source-planned artifact-only pilot — 2026-09-07

Scope: worker PR #1 on `automation/persistent-autoblogger-v1` only. The operator
explicitly approved another live test after the source-planning correction,
reaffirming that production must not be touched. No lander source changes,
PR #55 changes, publishing, deployment or schedule activation are authorized.

## One-use execution boundary

- Candidate: `vc-c1-d-ab0e55b1dd7f78fa`, `product demo checklist`.
- Prior failed run: `automated-product-demo-editorial-pilot-2026-09-07`.
- New run: `source-planned-product-demo-pilot-2026-09-07`.
- Normal candidate cap remains three. The distinct source-planning authorization
  permits exactly the fifth attempt after the retained failed fourth; no sixth
  attempt or automatic renewal is allowed.
- All three consumed target retry grants remain in history, including the fourth
  attempt's source/editorial failure. The older alternative-candidate grant stays
  parked and unchanged.
- One candidate, fresh automated research and source retrieval, at most four
  Responses API POSTs with the configured model, and one bounded repair.
- No manual evidence injection, article rewriting, acceptance override, source
  budget relaxation, model fallback, publication capability or lander PR.

The local runner requires the distinct `--approve-source-plan-retry` flag alongside
the exact `--candidate-file` and `--retry-target-from` arguments. It records the
approval before paid work. The ordinary retry, old switch and fourth-attempt flags
cannot stand in for this authorization, including when reloading a saved grant.

Prior state SHA-256:
`8afa248b30aebbc5ce32dba3820ba9f217f3e8907442560b3a25c0d2c496b67c`.
Eight prior run records and 19 failure entries are retained. An in-memory
preflight verified the fifth reservation/failure transitions without writing
state. Credentials remain in private ignored runtime files.

## Verification and outcome

Six new regressions failed before implementation. The focused recovery,
local-pilot and state suite then passed **224 tests**. Independent read-only
review found no Critical, Important or Minor issues in the scoped authorization
change. Full repository suite: **1,229 tests across 50 files passed**; lint,
typecheck, build and whitespace checks passed. Existing dependency build warnings
remain; no quality assertion or timeout was relaxed.

The live run passed fresh GET-only inventory at `2026-09-06T17:26:54.360Z` and
started research at `2026-09-06T17:26:55.676Z`. The lander review SHA was
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; publication was disabled. Offline
tests do not imply a successful generated article.

## Live evidence

| Collection | Apify run | Dataset |
| --- | --- | --- |
| Autocomplete | `v4wm8mDxA73YRCm9q` | `4yHXNk90gvfiCOacg` |
| Organic SERP | `ThRlZ8ELS3rdB5RGo` | `uqmWFUzoOknqUIRwM` |
| PAA first collection | `8QU7DGZMwt5hHSlcc` | `1B1uUv4BIEPnJcqno` |
| PAA bounded second collection | `GheSAB7rVaKDJomAW` | `UZjfcxhtfBot5s5Xc` |
| Authoritative-source support search | `weAaOjYvDbMVVxytg` | `qsqGEmaA5i3LPIQCx` |

Fresh US/en research returned eight organic results and 19 question strings
across organic/dedicated-PAA observations. The selected FAQs were exactly:

1. How to structure a product demo?
2. When starting a product demo, what should you do first?
3. Can you give me an example of a product demo?

Automatic source inspection completed at `2026-09-06T17:27:49.738Z`. Four bodies
returned HTTP 200: Aventi's product-launch checklist, UX Content Collective's
product-content checklist, CheckFlow's sales-onboarding checklist, and YC's Demo
Day pitch guide. The retrieved facts numbered 20 / 11 / 9 / 2 respectively.
The first three are adjacent-topic sources, not automatically evidence of a
product-demo competitor gap. YC was retrieved as the authoritative source but
contributed no cited derived words to the repaired article. Reachability and
lexical anchor overlap alone do not establish topical or article quality.

| Model stage | Completion (UTC on September 6) | HTTP status |
| --- | --- | --- |
| Draft | 17:28:40.522 | 200 |
| Critique | 17:29:39.388 | 200 |
| One repair | 17:30:17.513 | 200 |
| Final verification | 17:31:29.433 | 200 |

All four responses identified `gpt-5.5-2026-04-23`, matching the configured
`gpt-5.5` family without fallback. API-reported total usage was **117,393 tokens**
(not a cost estimate or Codex task usage). Context and all four response hashes
were verified. Raw bodies, prompts and responses remain private ignored files.

## Failed outcome and diagnosed blockers

The worker stopped at `2026-09-06T17:31:29.494Z` with **zero accepted Markdown
bundles, zero native article validations, and zero generated lander PRs**.

The first critique approved the draft, but 12 deterministic product-reference
findings correctly triggered the bounded repair path. The final result remains
blocked for multiple independent reasons:

- One ordinary explanatory sentence beginning “It illustrates the checklist
  principle” remained flagged as an ambiguous product reference. The final model
  review called that same span supported original guidance. This is a remaining
  cross-sentence reference-check disagreement, not resolved by the earlier
  imperative-object fix.
- Final verification returned evaluations for 12 deterministic findings, although
  `originalIssues` contained only model-critique issues (an empty list here).
  The worker rejected those invented issue IDs as `verification_unexpected`.
  The repair/verification issue contract needs explicit, consistent stable IDs
  for deterministic findings; accepting unknown IDs is not an appropriate fix.
- Final review rejected the `/customerTrigger` binding for claiming the chosen
  funded-founder/acquisition audience without cited source support. That field is
  private campaign metadata. Its campaign provenance and source-claim validation
  need clear separation; this review rejection was not overridden.
- Final independent classifications caused the unchanged source-use guard to
  count **226 CheckFlow-derived public words**, above the **180-word limit**.
  The other source totals were 136 / 66 / 0. Initial classifications counted
  only 79 CheckFlow-derived words; final verification reclassified unchanged
  spans. An initial accounting pass therefore does not guarantee the repaired
  article meets the limit. This is not fixed by removing reference false positives.

No article, evidence or review was manually rewritten, no finding was waived,
no second repair or fifth model request was made, and the failed live run has
not been relabelled as a successful offline run. No native QA/browser/Lighthouse
pass is claimed for this article. The uninterrupted engineering milestone remains
unproven; investigate the review contract and conservative source allocation
offline before considering further paid execution.

## Retained state and boundaries

The candidate is terminal at attempt five; its authorization is consumed.
State retains nine run records, 20 failure entries and all three earlier consumed
target retry grants. The old parked grant remains unchanged. `manualPilot` is
null, with no accepted content hash or PR number. A sixth attempt is refused.

Final state SHA-256:
`970ce9af34e53ee2d3ec0e9f6ef42da61698be66b237ba7bbdf032ef25ffb5a9`.

The original lander checkout remains clean on its review branch, and
`AUTOBLOG_SCHEDULE_ENABLED` remains `false`. Only the worker feature branch and
existing worker PR #1 are updated. No production branch, lander PR #55, deployment,
indexing or recurring schedule is changed.
