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
- New module independently reviewed; whole-change review pending.
- Existing gray-matter eval and vinext mixed-import build warnings remain.

Implementation commits: `02ac484` and `4e9f158`.

## Live attempt

Pending independent review. Selected unattempted identity:
`vc-c4-d-6ba2ed14ae4073c4`, keyword `testimonial video`, title
“How to Make a Customer Testimonial Video”. The normal runner will collect fresh
evidence; no source facts or article prose will be injected manually.

Pre-run state: 19 runs, 32 failure records, no consumed successful pilot;
SHA-256 `8511a9c018e40588998f64da424e975d2309251e027ad924390cb11d8454cf89`.
Original read-only lander SHA: `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
PR #55 remains open/unmerged. Earlier failures remain failures. No live success
claim is made by this software checkpoint.
