# Explainer-video live worker attempt

Date: 9 September 2026, Malaysia time. Worker implementation: `301adb5`.
Scope: worker PR #1; one local artifact-only attempt. No publishing authority.

## Result

**Failed before generation. The uninterrupted live article milestone remains
unproven.** The normal worker collected eight US/en organic results, four observed
Google questions and four source bodies, then rejected two FAQ evidence gaps.
There were zero OpenAI requests, drafts, accepted Markdown bundles, native article
QA runs or generated lander PRs. The independent critique and repair stages were
not reached. No model or production code was changed during this attempt.

Run: `faq-selection-explainer-proof-2026-09-09`.
Started: `2026-09-08T23:42:13.800Z`; finished: `2026-09-08T23:43:00.376Z`.
Candidate: `vc-c4-d-a7991cad8e6bb669`, campaign
`gtm-content-repurposing-buyer`, keyword `explainer video`.
Proposed title: **Explainer Video: Plan a Clear Product Story**.

The pending keyword adapter ran, but supplied no observed volume, difficulty or
CPC. `metricsEnriched: 1` in the run report means adapter execution, not paid
demand validation. Likewise, `eligible: 1` is the preliminary worker gate; the
later body-evidence check rejected drafting.

## Exact blocker

| Selected, observed question | Body-evidence result |
| --- | --- |
| What is the best explainer video? | No matching answer-shaped body anchor |
| How can I create an explainer video? | Eleven matching body anchors |
| What is the best AI to create explainer videos? | No matching answer-shaped body anchor |

The observed pool also contained “What are the different types of explainer
videos?” It did not provide enough supported alternatives to select three FAQs
under the current retrieval/matching rules. No question was invented or rewritten.

The four automatically retrieved source pages were:

- [Clipchamp explainer examples and tips](https://clipchamp.com/en/blog/explainer-video-examples-tips/)
- [Descript explainer-video guide](https://www.descript.com/blog/article/what-is-an-explainer-video-create-compelling-explainer-videos)
- [PlayPlay explainer examples](https://playplay.com/blog/explainer-video-examples/)
- [Lemonlight explainer-video guide](https://www.lemonlight.com/blog/explainer-video/)

All returned HTTP 200 and retained body hashes and fetch timestamps. Descript
qualified under the worker's existing authority policy. A qualifying authority
does not substantiate every comparison or product claim.

The result demonstrates a coverage/matching limitation for this candidate; it
does not prove that no useful answers exist on the web. The prior tutorial-video
diagnostic passed only for its own fetched corpus, not for arbitrary new topics.

An offline replay of the unchanged, hash-checked context reproduces exactly two
`research.faq_evidence_missing` findings with zero model requests. Payload SHA-256:
`0cce08527fd2d4acaf9f159479c416f2cec89d4035c0901f888c7f6b49f5f2ba`.

## Paid research provenance

| Stage | Apify run | Dataset | Reported USD |
| --- | --- | --- | ---: |
| Autocomplete | `xDo8z89exI8hIKg6d` | `mdQHH2Y8CabrHD8RX` | 0.00505 |
| Exact US/en SERP | `xPD6jI1giUughSHwt` | `APhoTvMa6HirUznAh` | 0.00295 |
| Seven support searches | `qT2gnuwJq4iUygKJV` | `uqJF3PpR2b2mXDwZI` | 0.01465 |

All three worker actors succeeded. Worker total: **$0.02265** in the provider's
`usageTotalUsd` fields. These are run-reported charges, not an account invoice.

Before the worker attempt, a bounded two-topic readiness screen and one
collection retry failed:

| Observation | Apify run | Outcome | Reported USD |
| --- | --- | --- | ---: |
| Initial autocomplete | `dIcz6jESP0dyBEAQ6` | Succeeded | 0.00585 |
| Initial two-query SERP | `YkxHic0gsfh5LAtPj` | Timed out at 120 seconds | 0.00100 |
| Retry autocomplete | `eCLd5rDceV7cZyfIq` | Succeeded | 0.00585 |
| Retry two-query SERP | `0Wt1tHQTWHhRBnY3c` | Timed out at 240 seconds | 0.00295 |

Provider logs record live AI-overview and redirect/proxy timeouts. The retry
returned an explainer observation, but the storyboard query stalled the batch.
The timed-out batch was not promoted to accepted evidence. The actual worker
queried the explainer topic afresh, using unchanged normal runtime limits.
The provider's [input reference](https://apify.com/apify/google-search-scraper/input-schema)
was checked during diagnosis; no undocumented actor switch was added.

Screening total: **$0.01565**. Combined reported charges: **$0.03830**.
No further paid run is queued.

## State, authority and verification

- The user authorized one bounded paid attempt. The existing one-use successor
  path selected a distinct topic; it did not retry the locked tutorial candidate.
  An initial private-file permission preflight failed before state/provider work;
  correcting the identity file to mode 0600 allowed the normal preflight.
- All 18 prior runs and all 31 prior failure records compare equal to the saved
  pre-run state. The new failed attempt brings the totals to 19 runs/32 failures.
  The explainer grant is consumed, its candidate is terminal at attempt one, and
  `manualPilot` remains null. The execution lock was removed normally.
- State SHA-256 changed through normal execution from
  `85cb3a1d21636a60cfe977e61e45be1c8951eda1709f3bbffe8b500444410caf` to
  `8511a9c018e40588998f64da424e975d2309251e027ad924390cb11d8454cf89`.
- Fresh checks: **2,031 tests across 54 files**, lint, typecheck and worker build
  pass. Existing gray-matter eval and vinext mixed-import warnings remain. These
  checks are not a new article's native lander QA or an end-to-end live pass.
- The original lander remains clean on `seo/founder-video-blog-launch`, SHA
  `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. PR #55 remains open/unmerged.
  `AUTOBLOG_SCHEDULE_ENABLED` remains `false`.
- No original lander write, generated article PR, merge, deployment, publishing,
  indexing submission or schedule activation occurred. Credentials, raw page
  bodies, local state and replay payloads remain private/ignored, outside Git.

Private receipts are under
`artifacts/autoblogger/faq-selection-explainer-proof-2026-09-09/`:
`run-report.json`, `source-inspection/`, `replay/draft-context/`,
`offline-preflight/`, `provider-receipt/`, `history-check/` and `execution-audit/`.

## Next engineering decision

Do not spend on another blind candidate switch. First investigate how to collect
additional real, relevant observed questions when the initial pool cannot yield
three grounded answers, and distinguish genuinely missing evidence from matcher
false negatives. Prove that behavior offline before another paid article attempt.
Do not fabricate questions, declare a universal “best” product without comparative
evidence, loosen source checks or reset failed state to manufacture a passing run.
