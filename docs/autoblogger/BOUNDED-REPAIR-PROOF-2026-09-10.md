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

## Explicit limits: verified software, second diagnostic still blocked

`c1b81d2` exposes per-location rendered-word, per-fact aggregate-word, citation-URL
and description-character allowances using the validator's existing accounting.
The request explains that the description formatting exception replaces both word
ceilings only when explicitly enabled. Unchanged sentences must retain their whole
citation set. Output schema and acceptance gates are unchanged.

Independent review found one minor test isolation gap, fixed in `08c8e1f`; scoped
re-review found no outstanding findings. **Final full suite: 2,355 tests across
57 files, zero failures/skips.** Lint, typecheck, worker build and whitespace checks
pass. The six-file implementation had 17 failing regression assertions before
implementation and 310 focused tests afterward. The final extra regression proves
duplicate fact IDs cannot double a single occurrence's allowance.

A second retained-input diagnostic used clean reviewed HEAD
`08c8e1fc401f2b04a8c9e8869ebcfd07810b278a`. One initial invocation supplied an
incorrect SHA and stopped at the clean-commit guard before credential loading or
paid requests; the actual invocation used the verified SHA. Both original model
requests still matched their hash-verified saved requests exactly.

The new patch request supplied the exact numeric limits. Its HTTP 200 response from
`gpt-5.5-2026-04-23` used **63,147 input and 7,526 output tokens**. It failed two
field-word-growth and seven per-fact-word-growth findings, across description,
direct answer, interview questions and one FAQ. Citation-set/immutable-binding
findings did not recur, but no semantic approval can be inferred from that.

This diagnostic also stopped **before** final independent review and native QA.
No accepted article, second repair pass, new worker attempt or pilot success was
recorded. There were no additional Apify calls. Private receipts are under ignored
`artifacts/autoblogger/explicit-limits-live-diagnostic-2026-09-10/`.

Two paid component diagnostics total: **124,311 input and 14,976 output tokens**.
These are provider-reported token counts, not dollar estimates. Both remain blocked;
neither is a fresh full-worker proof. A read-only check confirms the first bad patch
still fails the same six checks after adding guidance, so no gate was weakened.

Next correction remains in repair generation: produce supported edits within the
existing allowances. Do not erase history, keep trying new candidate identities,
manually rewrite the artifact, or claim that numerical guidance alone solved it.

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
