# Paid tutorial-video proof: stopped before generation

Date: 9 September 2026, Malaysia time. Worker implementation: `78c1e11`.
Run: `faq-bounded-tutorial-proof-2026-09-09`.
Observed execution: `2026-09-08T18:46:14.386Z`–`18:46:52.917Z`.

## Outcome

**The uninterrupted live research → draft → critique/repair → native QA milestone
is still not proven.** This user-authorized paid, local, artifact-only attempt
collected fresh search evidence and automatically retrieved four source bodies,
then stopped at the new FAQ evidence screen. There were no OpenAI calls, accepted
Markdown/SVG bundles, native validation runs, generated lander PRs or publishing.

| Stage | Actual result |
| --- | --- |
| Topic | `how to make a tutorial video` |
| Candidate | `vc-c4-d-30e73e9f2e08ea09`, GTM/content-repurposing buyer |
| Intended title | How to Make a Tutorial Video for Your Product |
| Local/remote lander inventory | Fresh GET-only check; clean matching `b6b0833c78443b44b12bf6d33f05baa7ac8427d3` |
| Exact US/en Google search | Seven organic results; twelve collected question strings |
| Supporting page retrieval | Four selected HTTP-200 body documents |
| FAQ screen | One of three selected questions has a matching body anchor; two blocked |
| OpenAI / draft / critique / repair | Zero requests; not reached |
| Native QA / article artifact | Not reached / none |
| Candidate state | Terminal at attempt one; failure retained |

The paid keyword provider remains `pending`; no volume, difficulty or CPC is
claimed. Its absence did not cause this manual-pilot rejection.

## Exact live provenance and provider-reported usage

| Observation | Apify run | Dataset | Reported USD |
| --- | --- | --- | ---: |
| Autocomplete | `M7bQ9zDgcdZV71QRX` | `TvERfQ9b0I5y2NLav` | 0.00505 |
| Exact organic SERP | `AwjVlwSTJ7K1GDjxV` | `zaq6A9J0CGGMFd89h` | 0.00295 |
| People Also Ask | `yRXPuR8zgxBLOUBKj` | `CgF2RfZVfobQgVn20` | 0.01100 |
| Supporting-source searches | `og4wyaIfMwhqAunsN` | `6NZiiaCi54UTWjPXn` | 0.00880 |
| **This worker attempt** | | | **0.02780** |

All four actor runs reported `SUCCEEDED`. Amounts are the observed
`usageTotalUsd` run fields, not an invoice estimate. They exclude the separate
preliminary screening described below. OpenAI usage for this attempt is zero.

Sources were automatically selected and fetched from:

- [Descript: tutorial-video guide](https://www.descript.com/blog/article/how-to-make-tutorial-video)
- [iSpring: tutorial-video guide](https://www.ispringsolutions.com/blog/how-to-make-tutorial-video)
- [Descript: how-to videos](https://www.descript.com/blog/article/how-to-videos)
- [Descript: tutorial production workflow](https://www.descript.com/blog/article/how-to-make-a-tutorial-video-show-dont-tel)

Raw source bodies and model-input context remain private ignored local receipts.
No facts, question wording or article copy were manually injected into this run.

## Why it stopped

The worker's fresh question selection differed from the preliminary screen:

| Selected observed question | Body-screen result |
| --- | --- |
| How to do tutorial video? | Anchor `source-1-fact-4` |
| What is a tutorial video called? | No anchor |
| How do I record my screen for a tutorial video? | No anchor |

Hash-verified offline replay reproduces exactly two
`research.faq_evidence_missing` findings and makes zero model calls.

These findings must not be overinterpreted as proof that the pages contain no
useful information. The iSpring recording passage contains actual screen-capture
steps under a tutorial-recording heading. The current matcher strips the heading
and requires the complete question subject in one answer-shaped sentence, so it
misses relevant procedural evidence spread across that passage. The naming
question has no clear naming answer in the selected passages; a generic workflow
paragraph should not be treated as one.

The next software work is therefore evidence coverage and passage-aware FAQ
matching, evaluated on these unchanged receipts. Relevant headings can establish
context but cannot become standalone evidence. Any eventual answer still needs
independent support review. Do not manually rewrite the questions, inject facts,
disable the gate, invent synonyms, reset the candidate or label this run passed.

## Preliminary screening and operator error

A separate, bounded screen checked three proposed queries: tutorial-video
creation, video storyboarding and explainer videos. Their Google results were
real, but the one-off screening driver passed the wrong argument shape to the
pending-metrics helper after source inspection. That produced an `intent`
validation error for two candidates. Storyboarding separately failed the
three-relevant-question selector.

The driver call was corrected and verified offline using its actual request
contract; the completed failed screening receipt was not replaced or called a
pass. The tutorial candidate was operator-selected from the observed search
results, not from a successful full screening verdict. The production worker
then independently recollected all evidence and applied every real gate. No
screening evidence or generated copy was injected into it.

## Verification and retained boundaries

- Fresh scoped verification: **391 tests across three files passed** (FAQ evidence,
  bounded repair and local-pilot controls). This was not a fresh full-suite/build
  run; the [previous correction](FAQ-REPAIR-FIX-2026-09-09.md) retains that evidence.
- Worker source did not change during execution; implementation remained `78c1e11`.
- All 17 prior run records and 30 prior failures preserve their original values.
  State now contains 18 runs and 31 failures. Prior content hashes and PR records
  are unchanged; the new one-use authorization is consumed.
- No active pilot reservation or execution lock remains. Previous exhausted
  candidates were not reset. No additional paid attempt is queued.
- Original lander, PR #55, both production branches and article approval states
  were not modified. Scheduling remains disabled. No deployment occurred.

Pre-run state SHA-256:
`05b1b876e2fa6226d139471aaf45c9b542e8ee6788bf97e0c4f3b7d598424bcd`.

Post-run state SHA-256:
`85cb3a1d21636a60cfe977e61e45be1c8951eda1709f3bbffe8b500444410caf`.
