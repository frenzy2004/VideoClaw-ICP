# Captions: observed secondary-keyword evidence

Scope: worker PR #1 only. Production, the original lander checkout, PR #55,
publication, generated lander PRs and the disabled schedule remain untouched.

## Actual fresh run — failed

`captions-live-proof-2026-09-12` ran on `1f2eafa` from 2026-09-11 17:45:28 UTC
through 17:53:06 UTC. It automatically completed research, source-body checking,
FAQ preparation, drafting, independent critique, one repair and final review.
The final review approved 72 support evaluations with no new issues. The worker
then rejected materialization with `content.secondary_keyword_missing` before
native site QA. Its status remains failed; the attempt was not reset.

- Primary query: `how to add captions to a video`.
- Google run/dataset: `CygH2wH0nVWUbt1OZ` / `cCpCfLDSdfg0CgYyh`.
- The captured PAA question “How can I add captions to a video for free?” is
  present verbatim in the reviewed visible FAQs.
- The serializer considered autocomplete and related searches, but omitted PAA.
- Persistent state after the run: 39 run records, 63 failure records; no
  successful fresh pilot. Historical failures remain unchanged.

## Correction and verification

The fallback now considers observed PAA alongside the other two search signals.
The same topicality, literal visible coverage, primary-keyword exclusion and
secret/control-character checks apply. No query, article copy, fact, review,
approval or candidate identity was rewritten to pass the check.

Two test-first failures reproduced the omission. After the correction:
2,823 tests across 63 files pass with zero failures/skips; lint, typecheck and
worker build pass. Existing Vinext dynamic-import warnings remain. Independent
read-only review found no actionable issues.

## Saved final artifact — native QA passed, not a fresh worker success

The unchanged final repaired draft and original independent reference review
were materialized with the corrected serializer. In an isolated lander clone at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`, native `check:blog`, lint, build and
workspace-integrity checks passed. The original checkout, state and receipts
were unchanged. No new model or research calls were used for this diagnostic.

Local ignored output:
`artifacts/autoblogger/captions-artifact-revalidation-2026-09-12/review-article.md`
and `review-graphic.svg`. The Markdown retains `review`, all four approvals
false, no publication date, `/download`, four sources, three FAQs, allowlisted
product media and pending paid metrics. It still requires human editorial review.

An earlier strict whole-drafter replay correctly stopped when the fix changed
the repair request's deterministic findings. Its diagnostic was not relabeled
as success. The later result proves final artifact materialization/native QA
only; it does not replay the complete drafting flow or satisfy the outstanding
fresh uninterrupted worker milestone.
