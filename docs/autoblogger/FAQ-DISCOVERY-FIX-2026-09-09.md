# FAQ discovery and body-supported selection

Date: 9 September 2026, Malaysia time. Scope: worker PR #1 only.
Starting commit: `78adf93`.

## Outcome

The source-evidence blocker is cleared in a bounded diagnostic using the existing
tutorial-video observations and automatically fetched page bodies. The real
drafter reaches its first model request. That request was intercepted before any
paid model execution: **this is research/preflight proof, not an accepted article,
new worker success, native article QA or publication approval.**

The [original paid run](FAQ-PAID-PROOF-2026-09-09.md) and its failed verdict remain
unchanged. The [previous procedure-context fix](FAQ-CONTEXT-FIX-2026-09-09.md)
remains a separate checkpoint.

## Root causes and changes

1. The normal title-bearing path ignored the selected FAQ questions. It now runs
   four short publisher-topic searches plus up to three deduplicated, single-line
   observed-question searches in one batch. This raises the support-query maximum
   from four to seven per inspected candidate; the 24-page fetch limit is unchanged.
2. The four-publisher discovery filter discarded useful exact-FAQ results.
   Publisher-directed results still require that scope. Exact observed-question
   results now use the same safe body reader as ordinary keyword results, with
   unchanged HTTPS, DNS/peer, redirect, size, content and topic checks. Discovery
   never grants authority; a qualifying authoritative source is still required.
3. A naming question was parsed as a definition, so explicit aliases could not
   match. A bounded naming path now requires an explicit assertion about the
   complete subject. Tests reject definitions, conditional subtypes, negations,
   teasers, wrong subjects, missing qualifiers, snippets and heading-only text.
   This remains a lexical retrieval screen, not semantic approval.
4. The first three observations were fixed before body research. The worker now
   retains up to nine topic-relevant observed questions, then selects the best
   three with body evidence in the existing relevance order. If fewer than three
   are supported, it retains the preferred set and its gaps so drafting still
   blocks. No new questions, answers, synonyms or source facts are synthesized.
   Source-set scoring caps FAQ coverage at three, so collecting unused additional
   answers cannot displace sources for the article's promised main workflow.

Exact keyword competitors and SERP/PAA provenance remain separate from support
searches. The original observation pool is retained in the evidence record.
Independent critique, bounded repair, source-use limits, publication gates and
candidate retry permissions are unchanged.

## Diagnostic evidence

One new Apify support-search actor completed:

- Run: `LZzbCQWj5eKQaWmTP`
- Dataset: `RX31dX94lTpGkVt5d`
- Seven US/en desktop, first-page support queries
- Finished: `2026-09-08T19:58:05.827Z`
- Reported `usageTotalUsd`: **$0.01465**

An initial request with a $0.25 charge ceiling was rejected before receiving a
run ID because the actor requires a $0.50 minimum ceiling. The successful request
used that ceiling. Subsequent diagnostic replays reused this completed dataset;
they did not start additional actors. Page bodies were fetched through the normal
reader. Raw responses remain in Apify/private ignored artifacts, not Git.

The final automatically selected FAQ set is:

| Observed question | Body anchor | Source |
| --- | --- | --- |
| How to do tutorial video? | `source-2-fact-4` | [Descript tutorial guide](https://www.descript.com/blog/article/how-to-make-tutorial-video) |
| How do I record my screen for a tutorial video? | `source-3-fact-6` | [iSpring tutorial guide](https://www.ispringsolutions.com/blog/how-to-make-tutorial-video) |
| What is a tutorial video? | `source-1-fact-1` | [ScreenPal tutorial guide](https://screenpal.com/blog/tutorial-video-ideas) |

“What is a tutorial video called?” is still unsupported in this corpus. It was
not falsely marked answered: the automatic selector chose another real,
topic-relevant observation with a fetched definition. The original failed run's
question set and verdict were not changed.

The final diagnostic context SHA-256 is:
`4bf2cb0e377b8d8a6d5827ef1f9d23d3fea9f4b87cd712566ec5cf75c88a8fd9`.
The original replay payload remains:
`de91cfa4bde1f39a944b1e5acb7d234bf29493a40b07aed3923ad2dc695550d5`.

The first model-boundary probe terminated on its deliberate stop sentinel before
saving a report. The corrected diagnostic catches that sentinel and records one
intercepted request and **zero OpenAI API calls**. No draft was generated or
accepted. This diagnostic is not a retry authorization or a successful pilot.

## Verification

- 27 added regression cases; source-query, source-admission, naming and selection
  failures were reproduced before their fixes.
- 2,031 tests across 54 files passed; the final machine-readable run began at
  04:15:29 Malaysia time and took 33.29 seconds. Lint, build and regenerated-route
  typecheck passed.
- The offline 50 → 10 → 3 workflow and one-artifact pilot fixtures pass. Those
  use the native article contract and a small static test renderer, **not** a
  fresh full production Next build. Earlier full native QA is historical.
- Existing gray-matter eval and vinext mixed-import build warnings remain.
- Independent review identified naming false positives and eviction of a
  main-workflow source by unused FAQ answers. New failing regressions reproduced
  these before the corrections. Final independent re-review found no outstanding
  findings within the agreed scope; this is checkpoint review, not publication
  approval.

## Boundaries and next milestone

State SHA-256 remains:
`85cb3a1d21636a60cfe977e61e45be1c8951eda1709f3bbffe8b500444410caf`.
No attempts, failures, retry grants, success markers or PR records were reset.
The lander remains clean on `seo/founder-video-blog-launch` at `b6b0833`; PR #55
and worker PR #1 remain open. `AUTOBLOG_SCHEDULE_ENABLED` remains `false`.
No lander source write, generated PR, merge, deployment, publishing or indexing
submission occurred. Runtime credentials and raw research are excluded from Git.

The remaining engineering milestone is a separately bounded full worker attempt
through generation, critique/repair and native QA. This checkpoint does not
waive the exhausted candidate's retry gate or claim that end-to-end outcome.
