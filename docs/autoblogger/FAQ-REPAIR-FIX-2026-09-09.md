# FAQ evidence and bounded repair correction

Scope: worker PR #1, `automation/persistent-autoblogger-v1`. This is an offline
software correction, not a new live pilot or a publishing approval.

## What changed

Before the first drafting request, every selected, observed FAQ now needs an
answer-shaped passage from the verified source bodies. Search snippets, headings,
question-only text and generic topic overlap do not satisfy this screen. Source
selection evaluates combined FAQ and title coverage within the existing four-page
limit, retaining an authoritative source. No fetch budget,
model budget or retry allowance was increased.

This is conservative lexical retrieval screening, **not semantic entailment**.
Definitions require the full subject and definition-shaped prose; duration and
cost questions require corresponding answer cues. Unsupported question forms or
ambiguous phrasing can be blocked. The independent critic still has to verify the
actual answer and every claim binding. No question or source fact is fabricated
or manually substituted to get through this gate.

The independent critic now identifies exact affected fields. Machine findings
and current binding reviews also identify repair locations. Free-text critic
instructions no longer unlock the entire article. Repair may change only those
fields; over-budget sources unlock their contributing locations for reductions.
Other text, bindings, FAQ questions, source inventories and structural shape stay
fixed. Allowed fields cannot grow or import another fact/citation. A bounded
description-formatting exception permits up to 200 characters; it does not waive
the source-use check. A stale or incomplete initial binding baseline cannot grant
repair permission: it needs a valid initial draft/review, not an inflated allowance.

After independent re-review, each source's derived-word ceiling is the smaller of
its original reviewed use and 120 words. The existing 180-word hard rejection
remains. This prevents a repair from trading a resolved local issue for increased
source use. Lexical limits cannot establish truth: the verifier checks every new
and unchanged assertion, and a larger redesign remains blocked rather than being
silently attempted within repair. Incomplete initial review blocks repair before
another generation request.

## Unchanged saved-run replay

Five private receipts from `context-budget-video-marketing-proof-2026-09-08` were
checked against their SHA-256 payload hashes. No receipt, copy or verdict changed.

- “What is video marketing?” has definition anchors in source 4.
- “What is AI video marketing?” has no qualifying body anchor and blocks drafting.
- “How much does video marketing cost?” also lacks an answer-shaped cost passage;
  generic budget mentions no longer count. The actual drafter returns blocked
  with zero generation calls and no bundle when replaying that saved context.
- The old repair's valid edit scope is only `/competitorGap`,
  `/faqAnswers/1/answer` and `/sections/2/markdown`.
- Its whole-article rewrite fails the delta gate before the verification request.
- Its source-use growth also fails independently:

| Source | Initial derived words | Repaired words | Repair ceiling |
| --- | ---: | ---: | ---: |
| Descript | 87 | 215 | 87 |
| Pipedrive | 39 | 81 | 39 |
| Park University | 26 | 95 | 26 |
| Amazon Ads | 119 | 233 | 119 |

The live run remains failed. This replay is rejection evidence, not a repaired
article, a new model response or a native QA pass for that article.

## Verification

Final worker verification: **1,959 tests across 54 files**, lint, build,
regenerated-route typecheck and whitespace checks pass. Two independent scoped
reviews were completed; their reproduced findings were fixed and rechecked.
Existing vinext mixed-import build warnings remain; this is not a warning-free
dependency audit. Changed-content secret checks and documentation-link checks pass.

Focused regression tests were observed failing before implementation, then passing.
The offline network/model fixture runs the actual worker through 50 candidates,
10 deep checks and three focused, independently reviewed repair responses. It
creates review-only Markdown/SVG artifacts, validates with the copied unmodified
native article contract, checks restarts and confirms zero GitHub writes. The
single pending-metrics pilot fixture also succeeds; rejection fixtures leave no
article artifact. Synthetic bodies and model responses are explicitly fixture
data, not live search evidence or editorial approval.

The fixture artifact is retained privately under
`artifacts/autoblogger/faq-repair-fix-2026-09-09/fixture/`; full native validation
uses a disposable clone, not the original lander workspace.

Full native validation passed all 32 blog tests, lint, the full Next build,
workspace-integrity check and cleanup at lander `b6b0833`. Validated fixture bundle
SHA-256: `65b294eb8bcd41e05440e28409abc857e7e0fb199527149bc9adf33336c38065`.

## Boundaries and remaining proof

No OpenAI/Apify request, candidate reset, new grant, live pilot, generated lander
PR, production change, deployment or schedule activation occurred. The local live
state remains byte-identical, SHA-256
`05b1b876e2fa6226d139471aaf45c9b542e8ee6788bf97e0c4f3b7d598424bcd`.
The old candidate remains terminal at attempt one; the old product-demo candidate
remains terminal at ten. The original lander stays on `b6b0833` and PR #55 is not
modified. The schedule remains disabled.

The uninterrupted **live** research → drafting → critique/repair → native QA
milestone is still unproven. Passing fixtures and rejecting the old failure do
not change that status. Any future live attempt must follow the existing explicit
authorization and retry-state rules; this correction creates no new permission.
