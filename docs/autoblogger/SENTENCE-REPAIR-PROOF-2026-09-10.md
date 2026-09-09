# Sentence-owned repair verification

10 September 2026, Malaysia time. Worker PR #1 only. This is a follow-up to the
two failed [bounded-repair diagnostics](BOUNDED-REPAIR-PROOF-2026-09-10.md), not a
replacement for those failure records.

## Why change the repair contract

Full-field patches fixed the dropped-immutable-binding problem, but the model
still exceeded word allowances even when given explicit numbers. The new design
lets code retain source and product references while the model edits bounded
sentences. Complex Markdown keeps explicit full-field repair. Neither mode grants
approval; existing independent evidence review and native lander QA remain required.

## Feasibility evidence

A read-only examination of the saved testimonial draft found 105 editable bindings
across 20 locations, each with one literal non-overlapping occurrence and only
whitespace between covered spans. This is evidence about that draft, not a claim
that arbitrary Markdown can use simple string replacement.

A tiny structured-output probe accepted word arrays with a maximum item count
(HTTP 200; 126 input / 39 output tokens). Its provider model was
`gpt-5.5-2026-04-23`. A separate Unicode-property-regex schema probe returned HTTP
400. Accordingly, the proposed provider schema uses a simple non-whitespace item
pattern and code performs the actual Unicode word validation.

The word-array probe's diagnostic logging regex was overescaped and reported zero
word counts. A separate correction receipt recomputed all returned items as one
word each without overwriting the original receipt. The probe returned ASCII text
for its Unicode request, so it does not prove provider Unicode-regex support.

These were synthetic schema probes, not article generation or acceptance.

## Pure repair module

Commits `2535ab5` and `e8e6945` add the v2 hybrid patch and a classification-only
allowance for ordinary double quotes. The original v1 code remains unchanged.
**242 focused tests across three files pass**, including 81 sentence-repair tests;
focused lint passes. Independent module and quote-follow-up reviews found no
outstanding defects.

On the captured failed draft the new code selects **19 sentence-mode fields with
90 bindings**; the worksheet field containing underscores remains full-field mode.
These counts describe mode selection, not successful edits or an accepted article.

An internal review report was accidentally committed in the first module commit;
the follow-up removes it from Git tracking while retaining the ignored local copy.
No credential or raw evidence was included in that report.

## Integrated software checks

`b19dd48` connects the prepared workflow to `videoclaw_article_repair_patch_v2`.
Tests exercise real assembly before independent verification, including rejection
of unsupported repairs and malformed sentence edits. Legacy nonprepared repair
keeps its previous path. Integration regression tests first failed against v1,
then all 156 focused tests passed after the change.
Independent integration review approved the patch and confirmed current binding
manifests, source accounting, answer length, product support and native validation
remain mandatory. No additional model call or fallback was introduced.

The full suite at `b19dd48` passes **2,442 tests across 58 files**, with zero failed
or skipped tests. Lint, typecheck and worker build pass. Existing dependency eval
and vinext mixed-import build warnings remain; this is not warning-free output.
Private machine-readable results are in
`artifacts/autoblogger/sentence-repair-verification-2026-09-10/tests.json`.

The worker build and offline fixtures do not establish native QA for a real model
draft. Paid article verification is recorded separately when performed.

## Completion standard

Software checks and a retained-input component diagnostic do not prove a fresh
automatic worker run. The full milestone still requires research → drafting →
critique/one repair → native QA → review-only Markdown, without manually injected
evidence or rewritten copy. No production, publishing or schedule activation is
part of this correction.
