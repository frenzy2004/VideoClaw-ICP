# FAQ procedure-context correction

Date: 9 September 2026, Malaysia time. Scope: worker PR #1 only.
Starting commit: `8371f91`.

## What changed

The [paid tutorial-video attempt](FAQ-PAID-PROOF-2026-09-09.md) exposed a false
negative: a recording procedure's heading named the tutorial video, while its
body gave screen-capture instructions. The matcher required all those words in
one body sentence and discarded the useful procedure context.

The matcher now supports a narrow additional retrieval path for questions shaped
as recording, editing or exporting an object **for a stated purpose**. The
extracted heading must explicitly name that operation and purpose. A concrete
complete imperative body step must name the requested operation and object as a
direct instruction or selected control. Regression tests reject heading-only matches,
teasers, disabling instructions, mismatched purposes and words scattered across
unrelated actions or separate source facts. The same matcher is used during
source selection and drafting preflight.

The new path deliberately declines compound instruction tails, even when those
may be useful prose. It checks the original imperative verb, retains clause
punctuation and matches the whole operation/object phrase rather than a prefix.
It does not promise unrestricted English comprehension.

This is an evidence-retrieval check, not semantic approval of generated copy.
Independent answer/binding review, source-use limits, the single bounded repair
and native publication checks are unchanged. No question, source fact, article
copy or historic verdict was manually rewritten.

## Result on the unchanged failed input

| Observed FAQ | Before | After |
| --- | --- | --- |
| How to do tutorial video? | `source-1-fact-4` | Unchanged |
| What is a tutorial video called? | No usable anchor | Still blocked |
| How do I record my screen for a tutorial video? | Incorrectly no anchor | `source-2-fact-6` |

The newly recognised anchor is the already-fetched iSpring recording procedure;
no replacement source or fabricated explanation was supplied. Offline replay of
the real drafter reduces the finding count from two to one and makes zero model
calls. **The historic run remains failed, and a complete live article remains
unproven.** The naming FAQ still needs an actual answer source before this
candidate could qualify; this patch does not guess a synonym or bypass that gate.

The replay payload SHA-256 remains:
`de91cfa4bde1f39a944b1e5acb7d234bf29493a40b07aed3923ad2dc695550d5`.

## Verification and boundaries

Regression tests cover the false negative, unrelated and non-instructional
prose, missing qualifiers, source/snippet separation, source selection and the
real drafting preflight. Synthetic fixtures are independently written; fetched
page bodies and credentials are not committed. Four new regression cases failed
against the original matcher before implementation. Temporarily disabling the
new path reproduced six regression failures, including both integration tests.

Independent review exposed three additional classes of misleading matches:
imperative teasers, operation/object words from separate actions and disabling
instructions. Eight new cases reproduced those admissions before the follow-up
fix; extractor-level regressions also cover flattened HTML list items.

A second review caught non-imperative verb forms, object/help-destination suffixes
and discarded clause separators. Further failing regressions led to the bounded
complete-instruction grammar above. Final independent re-review found no
remaining important or critical findings in this scoped change.

Fresh full verification: **2,004 tests across 54 files passed**, lint passed,
build passed and regenerated-route typecheck passed. The full suite started at
03:14:37 Malaysia time and took 99.45 seconds. Existing vinext mixed-import build
warnings remain; this is not a warning-free build or a live article acceptance.

All eight changed/new files pass exact runtime-credential checks. The added diff
and new report pass secret-pattern checks; existing synthetic secret-rejection
test strings were not mistaken for leaked credentials. Relative documentation
links and whitespace checks pass. Only code, tests and compact documentation are
included in Git; credentials and raw research/replay receipts remain ignored.

The local state SHA-256 remains unchanged:
`85cb3a1d21636a60cfe977e61e45be1c8951eda1709f3bbffe8b500444410caf`.
No retry authorization, candidate counter, run, failure or publication marker
was changed. No paid run, lander edit, generated lander PR, production action or
schedule activation occurred. The original lander stays clean at `b6b0833` on
`seo/founder-video-blog-launch`.
