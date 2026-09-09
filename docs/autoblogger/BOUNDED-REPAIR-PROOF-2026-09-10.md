# Bounded repair correction and retained-input diagnostic

10 September 2026, Malaysia time. Worker PR #1 only. No original lander, production,
publishing, schedule, pilot-state or failed-history edits.

## What changed

The normal prepared-evidence path requests replacements for permitted text fields
instead of regenerating the complete article. Code copies every untouched field
and binding. Changed fields must supply complete local bindings; no new evidence
IDs, structural changes or unsupported citation destinations are accepted. The
existing content, delta, source-use, product-claim, independent critique and native
checks remain authoritative. Legacy direct callers keep their previous contract.

The independent module review caught a captured URL-identity normalization bug;
the fix accepts valid already-normalized identities without stripping `www` twice.
Both the module re-review and integration review passed. Implementation commits:
`67f9589`, `c787e00`, `3b41d97`.

## Verified software checkpoint

At `3b41d97`: **2,339 tests across 57 files passed**, zero failures/skips, plus
lint, typecheck, worker build and whitespace checks. The suite includes offline
native-lander checks, not a live generated article's native approval. Existing
gray-matter eval and vinext mixed-import build warnings remain.

## Paid retained-input diagnostic — blocked

The diagnostic used the exact hash-verified research context, first draft and
initial critique from `semantic-faq-testimonial-proof-2026-09-10`. Current initial
draft/critique requests had to match their saved requests exactly. No facts,
citations, answers or article prose were manually injected or rewritten.

Only the new repair was a paid request. It returned HTTP 200 from
`gpt-5.5-2026-04-23`, using **61,164 input and 7,450 output tokens**. No new Apify
request occurred. The two-call ceiling included optional independent verification,
but that second call was not made because the delta check blocked the output.

This fixes the original dropped-immutable-bindings failure, but does **not** prove
an accepted article. The diagnostic still found five per-fact word-growth issues
and one changed citation set on unchanged text, across three edited fields.
There was no accepted Markdown, final independent review, native article QA or
successful worker-pilot marker.

The follow-up [explicit repair limits correction](../superpowers/specs/2026-09-10-explicit-repair-limits-design.md)
supplies the existing validator's exact numeric allowances to the generator;
it does not relax those limits. The failed diagnostic remains failed.

## Integrity and remaining milestone

Original state remains **20 runs, 33 failure records, no successful pilot**:
`afa9448ad5ab8a9813fbfd5b7aa1b0acc31a7570629896e9ae59ebeccdbbb6f9`.
Original lander remains clean at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. Scheduling is `false`.

Private receipts are under ignored `artifacts/autoblogger/repair-patch-live-diagnostic-2026-09-10/`.
They are a component diagnostic, not a new worker attempt or fresh research.
The original testimonial attempt remains terminal at one. No reset, renamed
identity, additional grant, generated lander PR or production action occurred.

The remaining engineering milestone is still one automatic article accepted
through research, drafting, critique/one repair and native QA. Passing tests or
replaying stored inputs does not complete that milestone.
