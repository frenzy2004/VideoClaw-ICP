# Product-demo review artifact — 2026-09-06

Outcome: **an automatically researched, generated and repaired article passed
native lander QA after a checker fix and offline revalidation of unchanged model
responses**. This is not a clean uninterrupted worker success or publication approval.

## Live execution

- Run: `automated-product-demo-attribution-pilot-2026-09-06`.
- Candidate: `vc-c1-d-ab0e55b1dd7f78fa`; keyword `product demo checklist`.
- Title: **Product Demo Checklist: Plan, Record and Rehearse**.
- Mode: one explicitly authorized artifact-only pending-metrics pilot.
- Model: exact `gpt-5.5`, with no fallback.
- Fresh GET-only GitHub inventory and a clean local lander preceded execution.
- Research began `2026-09-06T02:59:54.303Z`; the worker failed at
  `2026-09-06T03:04:48.729Z`.

| Automatically collected evidence | Apify run | Dataset |
| --- | --- | --- |
| Autocomplete | `IAwSttp659nbOEnR0` | `p7KbQEJsmAYALeclL` |
| Eight US/English-interface organic results | `qg93QBx63bMuRgIe8` | `mBeYTLx9KpmhdKmho` |
| Dedicated PAA collection | `WulhaqaIK79W1l9zz` | `5pq68PLj6cE5a9G42` |

The selected questions were:

1. What is a product demo?
2. What are the steps involved in a product launch checklist?
3. When starting a product demo, what should you do first?

The second question is adjacent to the demo topic, not an exact intent match.
Its answer was repaired to separate original launch-planning guidance from
source-supported demo preparation. It still needs editorial relevance review.
PAA answers were not treated as supporting source facts.

Source bodies were automatically retrieved from CloudShare, Demio, Demodia and
a Y Combinator company job page. The article cites only the first three:

- [CloudShare demo checklist](https://www.cloudshare.com/blog/demo-checklist/)
- [Demio product demo checklist](https://www.demio.com/blog/product-demo-checklist)
- [Demodia product demo checklist](https://demodia.com/product-demo-checklist)

The Y Combinator page was an authority fallback in research, not a cited source
or an endorsement. Fetch timestamps, hashes and body passages remain in ignored
local evidence; no fact was manually injected. Paid volume, difficulty and CPC
remain `provider-pending`.

## Model review and the deterministic defect

Draft generation, critique, the single repair and independent verification each
returned HTTP 200: **four paid calls total**. The initial critique identified
audience-framing, named-publisher attribution, original-synthesis and launch-FAQ
scope issues. The final verification approved every binding, marked all four
issues resolved and reported no new issues.

The worker still stopped because deterministic checks misread three ordinary
grammatical uses as unsupported VideoClaw product references:

- a dummy “it” in deciding whether a video should educate or persuade;
- “it” referring to watch time;
- “it” referring to a customer problem in a demo-outline instruction.

Regression tests reproduced the false positives before changing the checker.
The fix recognizes bounded grammar and ordinary antecedents; explicit product
aliases, prior product context and capability assertions still require support.
Independent review caught an overly broad suffix exemption, which was reproduced
and fixed by anchoring the entire allowed sentence. Capability-suffix regressions
remain in the suite.

## Unchanged-response revalidation

All four original responses were replayed through the production drafter with
their saved context. Receipt hashes were verified. This produced a ready bundle
without new paid calls, manual evidence changes, copy rewriting or state mutation.
The final tightened checker produced the identical bundle.

Bundle SHA-256:
`1e2737e160a0c2aa923eb919914393b95b369eab8065039e22a4dbd34942badc`.

The native publisher validated that bundle in a disposable clone of lander
`seo/founder-video-blog-launch` at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`:

| Check | Result |
| --- | --- |
| Native `npm run check:blog` | 32 tests passed |
| Native lint | Passed |
| Native build | Passed |
| Disposable checkout integrity and cleanup | Passed |
| Original lander checkout | Unchanged and clean |
| Persisted pilot state | Byte-identical before/after revalidation |

Native build success is not browser or Lighthouse verification of this new
review article. Production visibility gates still exclude review articles.

Private local artifacts, relative to this worker checkout:

- `artifacts/autoblogger/automated-product-demo-attribution-pilot-2026-09-06/review-artifact/product-demo-checklist.md`
- same directory: `product-demo-checklist.svg` and `product-demo-checklist.bundle.json`
- `artifacts/autoblogger/automated-product-demo-attribution-pilot-2026-09-06/revalidation-final/native-validation/validation-report.json`

The exported Markdown is byte-identical to the bundle. The SVG export differs
only by a terminal newline; native validation used the exact bundle SVG.
These artifacts are ignored local review files, not files in the lander or
attachments to this implementation PR. Raw responses/source bodies stay out of Git.

## State, quality and release boundaries

The original live run remains **failed**, with the candidate **terminal at
attempt three**. Seven failed runs and 18 failure entries are retained. The
previous consumed retry approval is preserved in `retryHistory`; the latest
exact-run approval is consumed. The earlier candidate's unused grant stays
parked. No retry count was reset, no fourth attempt was granted to this candidate,
and no successful pilot marker or prepared-publication envelope was created.
Three pre-existing PR #55 article identities in inventory are not new PRs.

The bundle is `status: review`, with all four approvals false, no
`publishedAt` and a `/download` CTA. Its media comes from the approved lander
allowlist plus the deterministic editorial SVG.

Technical acceptance is not enough to call this high-quality production copy.
The description repeats the title, “Original recommendation” labels interrupt
the prose repeatedly, and one FAQ is broader than the primary search intent.
Those are explicit editorial follow-ups, not silently fixed manual copy.
A clean uninterrupted worker pass and rendered-page review are still unproven.

Fresh software verification: **1,028 tests / 49 files**, lint, typecheck, build
and whitespace checks passed. Independent scoped review found no remaining
P1/P2 after the grammar tightening and ran 63 focused tests successfully.
Existing gray-matter/vinext build warnings and the native install-script warning
remain; there is no warning-free claim.

All implementation changes belong to worker PR #1 into `seo-campaign`.
PR #55 remains open/unmerged, the lander source is untouched, and
`AUTOBLOG_SCHEDULE_ENABLED=false`. No generated lander PR, publication,
production change, deployment, indexing submission or schedule activation occurred.
