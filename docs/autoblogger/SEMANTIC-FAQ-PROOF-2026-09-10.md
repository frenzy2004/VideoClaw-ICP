# Semantic FAQ preparation and artifact-only proof

Date: 10 September 2026, Malaysia time. Worker PR #1 only. No publishing,
lander edits, production, deployment, indexing or schedule activation.

## Software correction

The normal worker now prepares FAQ evidence before drafting. One structured
GPT-5.5 request selects exactly three distinct observed PAA questions from at most
nine, with literal body excerpts and source-fact IDs. Code checks observed
membership, body-only anchors, distinct keys/intents and a research-context hash.
Headings and snippets cannot supply body proof. Preparation is not approval:
independent critique still evaluates answer support, relevance, distinct intent,
copying and product claims. Exactly one repair and one final verification remain.

Preparation failure cannot fall through to drafting. Local execution opts into
five model requests, counting failures; the legacy audit default remains four.
Selected questions reach native article metadata and publication attribution.
Private replay retains preparation input/output. A 0600 `*.faq-evidence.json`
accompanies accepted artifacts, outside compact Git state/report and public prose.

## Verification

- 2,257 tests across 56 files pass, zero skipped.
- Lint, typecheck, worker build and whitespace checks pass.
- Offline end-to-end tests cover 50 candidates → 10 deep checks → 3 repaired
  artifacts with the ICP cap and native lander validation. This is fixture proof.
- Tests cover preparation refusal, retained attribution, stale evidence,
  independent critic rejection, receipt privacy and rejection of a sixth request.
- New module and whole correction independently reviewed; no findings.
- Existing gray-matter eval and vinext mixed-import build warnings remain.

Implementation commits: `02ac484` and `4e9f158`.

## Live attempt

Completed live attempt `semantic-faq-testimonial-proof-2026-09-10`, outcome **failed**. Selected identity:
`vc-c4-d-6ba2ed14ae4073c4`, keyword `testimonial video`, title
“How to Make a Customer Testimonial Video”. Fresh research collected eight organic
results, four initial PAA questions, seven relevant questions after support search,
and four source bodies. No source facts or article prose were injected manually.

The new preparation step succeeded: definition, example and production-process
questions were selected with validated literal body anchors. Draft and independent
critique also completed. Deterministic source accounting required a repair at
199/368 derived words for two sources versus the 180-word ceiling.

The repair returned only 40 of the initial 132 bindings while retaining most prose.
It failed 28 delta findings: one location growth, two evidence expansion, five
evidence growth, four immutable bindings, six changed-evidence, ten coverage.
No final verification call, accepted Markdown artifact or native article QA occurred.
The failed candidate is terminal at attempt one. No reset or replacement identity.

All four model requests returned HTTP 200 using `gpt-5.5-2026-04-23`:
108,347 input tokens and 28,806 output tokens. These are reported token usage, not
a dollar estimate. Three Apify runs succeeded, total reported usage **$0.02265**:

| Role | Run | Dataset |
| --- | --- | --- |
| Autocomplete | VxiyCTF8rVOJERTYR | yiYEETV2eLt5t3opB |
| Target SERP | R6zvmIqkfg8n8yOaF | VLHXb3yI8MJyTrphw |
| Support search | iZfxa4KKiKVxxbF1o | 2rSiBfWKZrN3PoFWs |

The next correction is [bounded field repair output](../superpowers/specs/2026-09-10-bounded-repair-patch-design.md), not another keyword switch or permission to weaken QA.

Pre-run state: 19 runs, 32 failure records, no consumed successful pilot;
SHA-256 `8511a9c018e40588998f64da424e975d2309251e027ad924390cb11d8454cf89`.
Original read-only lander SHA: `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
Post-run state: 20 runs, 33 failure records, no consumed successful pilot;
SHA-256 `afa9448ad5ab8a9813fbfd5b7aa1b0acc31a7570629896e9ae59ebeccdbbb6f9`.
PR #55 remains open/unmerged and its original checkout clean. Scheduling remains
false. Earlier failures remain failures; the live article milestone is unproven.
