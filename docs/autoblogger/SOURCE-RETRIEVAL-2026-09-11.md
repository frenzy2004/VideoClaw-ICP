# Source retrieval checkpoint — 2026-09-11

This extends the [citation and editorial checkpoint](OBSERVATION-AND-EDITORIAL-REVIEW-2026-09-10.md). It is worker-only engineering evidence, not production or article approval.

## Fresh attempt retained as failed

`automate-video-editing-live-proof-2026-09-10` targeted `automate video editing`, derived from the observed question “Is there a way to automate video editing?” in prior SERP dataset `ZqJRPJPqcdnaaHxSr`. This is the task of choosing automation boundaries and human review, distinct from the preceding general editing-workflow article. No paid demand metrics were claimed.

The new exact-query US/en SERP returned eight organic results and twelve Google questions. SERP run/dataset: `8aesdz2cja9LRyUj2` / `L7gFBSOpiNsW4mNF1`. Autocomplete: `l6nqT5x9kX227epwG` / `1b6cb0vb0kYJs9ULK`. PAA attempts: `SVC1odJ9NFfG7BjHw` / `jsEHcjZZynsrKFrS4`, then `osiAK3VsShvdkWmfk` / `6ZUKzmlspFS7kDuM6`.

The run failed source selection before any model generation. An initial preflight refusal concerned the local candidate file's permissions; correcting it to `0600` did not change state or consume an attempt. The subsequent real attempt remains terminal at attempt one. State now has **27 runs / 46 failure records**, no active pilot, SHA-256 `0fd94d1b9a904c968ba4cac6049f7105c3922eb63386c3d20dbba6be17510bc6`.

## Diagnosed defects and bounded corrections

The real reader fetched relevant organic pages successfully, but the lexical screen rejected `automated`, `automatic` and `automatically` against `automate`. It also distinguished the verb forms `edit`, `edited` and `editing`. Two closed word families now normalize these terms **only for retrieval scoring**. All remaining query qualifiers must still occur together in a bounded 6–48-word body sentence with additional prose. Heading-only, cross-sentence, missing-qualifier, oversized and unrelated near-match cases still fail. No prefix stemming, source-text rewrite, query rewrite or semantic approval is introduced.

Shotstack's [first-party technical workflow guide](https://shotstack.io/learn/automating-video-editing/) was reachable, directly topical and previously excluded from recognized authority. Only exact `shotstack.io` and `www.shotstack.io` hosts under `/learn/` now qualify as first-party technical guidance. This does not establish independent market evidence, comparative superiority, correctness of every claim or VideoClaw capabilities. Root, pricing, dashboard, lookalike hosts, neighboring paths and redirects outside that scope do not inherit authority. Discovery queries and the 24-page budget remain unchanged.

## Live reader proof and tests

Using the eight URLs from the saved exact-query SERP, the unwrapped production reader retrieved bodies afresh and automatically selected:

| Page | HTTP | Authority | Extracted passages |
| --- | --- | --- | --- |
| `shotstack.io/learn/automating-video-editing/` | 200 | First-party technical guidance | 7 |
| `veed.io/tools/auto-video-editor` | 200 | No | 16 |
| `kapwing.com/ai/autocut` | 200 | No | 20 |

This diagnostic started no Apify actor, made no model call and wrote no worker state. The full source text, page hashes and passage offsets remain in ignored local receipts under `artifacts/autoblogger/automation-source-selection-fixed-2026-09-11/`; no facts were manually supplied or substituted.

TDD first reproduced ten word-form/selection failures and three authority-policy failures. All **2,629 tests** then passed, with zero failures or pending tests; lint, typecheck and build pass. Existing dependency bundling warnings remain. Independent review found no actionable issue in the word-form change, including additional in-memory checks of unrelated terms. Source rules were reviewed with exact-host/path, redirect-loss and topical-body regressions.

The next milestone remains one uninterrupted fresh worker run through new generation, critique/one bounded repair, and native QA. The earlier saved-generation component passed editorial review but failed source-use budgets; these retrieval fixes do not change those budgets or approve that draft. No failed candidate was reset, no lander changes or PRs were made, and publishing, deployment, indexing and the schedule remain disabled.

## Fresh buyer-intent attempt and remaining admission problem

After committing the fixes, `automated-editor-buyer-live-proof-2026-09-11` researched `best automated video editor` for a C4 GTM buyer choosing a solution. This distinct commercial intent was derived from the preceding observed Google question, not a renamed retry of the how-to candidate. Exact SERP: `FXf1NcgrseRfqO4YX` / `TLBicgEEPeHlpSqBg`; completed support search: `YnfpMiGBS7In2YyMx` / `UoI8ouREvQ9sG8NvF`. It collected eight organic results and ten questions, then failed source admission before OpenAI, drafting or native QA.

A read-only diagnostic subsequently fetched the two highest TechSmith and two highest Descript support results. All four returned HTTP 200 and recognized authority, with 8, 9, 11 and 11 extracted passages. All scored zero against the full query. The main editor guides describe automation and editing using contextual references, but do not repeat every core query term together in a qualifying body sentence. This identifies a remaining limitation of the lexical admission rule, not an access or credential blocker. Page titles alone must not become evidence, and this observation does not establish every proposed claim's support.

The next software step is bounded, auditable source-relevance verification using actual page context, with fixtures for these misses and unrelated-heading counterexamples. It must retain live body retrieval, authoritative-source requirements, exact fact attribution, independent claim review and all retry/source-use limits. Further candidate spending is paused until that admission path is exercised directly; no terminal candidate will be reset to obtain a success label.

Latest state: **28 runs / 48 failure records**, no active pilot, SHA-256 `0be8119b09d2b1f522dffe48fc4de00ddf29e59f1574e7225b1b6a1746ad61b6`. Code remains verified by the 2,629-test suite, lint, typecheck and build; a fresh whole-worker article proof remains outstanding. The lander checkout remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
