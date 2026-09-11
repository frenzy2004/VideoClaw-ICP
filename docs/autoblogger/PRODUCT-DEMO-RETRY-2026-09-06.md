# Product-demo automatic retry — 2026-09-06

Outcome: **research and all four model calls completed; final article review failed**.
No generated Markdown bundle, native generated-article QA pass or lander PR resulted.
The older assisted local page is not this run's output.

## Exact execution

- Run: `automated-product-demo-retry-2026-09-06`.
- Candidate: `vc-c1-d-ab0e55b1dd7f78fa`, keyword `product demo checklist`.
- Mode: one authorized local artifact-only pending-metrics pilot; exact model `gpt-5.5`.
- Research began `2026-09-05T23:17:39.359Z`; failure recorded `2026-09-05T23:21:18.638Z` (September 6 in Malaysia).
- Fresh GET-only lander inventory preceded execution. No publication backend was supplied.

| Evidence | Apify run | Dataset |
| --- | --- | --- |
| Autocomplete | `f4oHDEQ5HhsKn5sKB` | `AgnsPJ0PXr7pIpZcZ` |
| US/English-interface organic SERP | `AmeFPWQMoxdpdmtba` | `xQS60tnwlIOGFkzwO` |
| Separate PAA collection | `WOmHE9ypBXcgxeqV7` | `s9m9VoJvtRhbNHq5o` |
| Supporting primary-source search | `JOObow6xGbjvQYkD0` | `dlr4UgBrnIurBJWUC` |

Automatic research returned eight organic results, three relevant FAQs and four
retrieved source bodies: presales.rocks, CloudShare, Product Marketing Alliance
and Y Combinator. Checked passages and fetch/hash provenance reached drafting
without manual fact injection. Volume, difficulty and CPC remain pending.

## What failed and what changed

Generation, independent critique, the single repair, and independent repair
verification each returned HTTP 200. HTTP success is not editorial approval.
The repair resolved all four initial critique issues, but final verification
rejected two previously accepted, unchanged bindings:

1. `competitorGap` included rehearsal among themes attributed to CloudShare/PMA,
   although its cited passages did not support that attribution.
2. A list of possible demo outcomes added examples not in its cited facts without
   clearly identifying them as original examples in the visible context.

The deterministic product check also incorrectly classified an ordinary sentence
about turning prospect research into a buyer brief as a VideoClaw assertion.
Three reproduced failing tests led to a narrow noun-phrase recognition fix.
Four additional cases retain blocking for software modifiers and ambiguous
pronouns after an explicit product reference. No approved-product-claim rule was removed.

An offline replay used all four **unchanged saved responses** with the corrected
checker. Deterministic findings became empty, but the independent review's two
attribution failures still blocked the article. This replay used no network,
paid calls, evidence replacement, article rewriting or state updates.

Generation/repair instructions now explicitly distinguish sourced themes from
original additions in `competitorGap` and label invented outcome lists. Both
review stages apply the same named-publisher attribution rule. Repair explicitly
rechecks unchanged bindings too. Metadata was already in scope; the clarification
addresses inconsistent classification, not missing metadata coverage. These
prompt changes are tested but have **not** been proven in another live generation.

## Retry history and release boundaries

The authorized retry adds a one-use, exact-candidate/exact-run approval beneath
the consumed target switch. It preserves the original terminal decision snapshot,
failed run, old candidate's unused grant and all earlier failure history. Normal
attempt accounting advanced from one to two; the new failure is terminal.
The transient queue fix avoids resurrecting the parked terminal candidate merely
to reconcile its stale backlog wording.

There are six retained failed runs and 17 failure entries. No content hash or
successful pilot was recorded. The new retry is consumed; no further retry was
granted, no fifth model call was made and no counter was reset.

Fresh verification: **1,007 tests across 49 files passed**, plus lint, typecheck,
build and whitespace checks. The existing gray-matter direct-eval and vinext
mixed-import build warnings remain. Fixture/native-validator tests passing is
not a native build of this blocked article.

Independent scoped reviews found no P1/P2 issues in retry/history handling or
the later four-file product-reference/prompt correction. The latter review ran
54 focused mocked tests. The proposed diff/report passed runtime-value and
secret-pattern scanning without printing credentials.

Lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
PR #55 remains open/unmerged; `AUTOBLOG_SCHEDULE_ENABLED=false`. No production,
publication, deployment, indexing or schedule activation occurred. Raw page/model
data and credentials remain in ignored local runtime storage, not this report.

The automatic article milestone is still incomplete. A future explicitly bounded
attempt must pass editorial verification and native lander QA; the stored failed
response must not be relabelled as approved or manually rewritten as proof.
