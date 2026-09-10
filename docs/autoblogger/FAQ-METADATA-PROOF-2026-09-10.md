# FAQ metadata correction and fresh worker evidence — 10 September 2026

## Current outcome

The fresh template run completed automatic research, source retrieval, FAQ
preparation, generation and independent critique. It failed before repair and
native QA. The metadata correction then passed a separate paid critique/repair/
verification diagnostic. Native blog tests and lint passed, but its build found
an empty secondary-keyword array. The worker's serialization fallback is now
corrected and tested; post-fix native revalidation is separate below. **A successful
uninterrupted live article is still unproven.**

Scope remains worker PR #1, `automation/persistent-autoblogger-v1` into
`seo-campaign`. No lander source changes, generated lander PRs, production
operations, publication or schedule activation.

## Fresh full-worker attempt

Run: `testimonial-template-live-proof-2026-09-10`, worker commit `391c511`.
Candidate: `vc-c4-d-f449147eb4bb1ad6`, keyword `testimonial video template`.
It is distinct from the terminal questions and general-testimonial candidates.
The earlier three-topic pre-screen was not supplied as evidence: only the
candidate identity entered this new full worker attempt.

| Stage | Completed evidence |
| --- | --- |
| Autocomplete | Run `TX1McoQVDWvQ65cna`, dataset `7tEdROsIAB2zr2WPg` |
| Fresh US/en SERP | Eight organic results, four PAA; run `DwyugdHR0Uf2zML5i`, dataset `gdcqwBxQHNJg9vKhf` |
| Supplementary search | Run `EkSMaHz1aoRvyX5zM`, dataset `5GXxEaL2aHCJ784b8` |
| Source retrieval | Four HTTP-200 pages, 44 retained body passages, one approved authoritative source |
| FAQ preparation | Three observed questions mapped to retrieved body anchors |
| Generation | A new draft with worksheet, hypothetical example and troubleshooting |
| Independent critique | Completed; subsequent deterministic checks rejected acceptance |
| Repair/native QA | Not reached |

All three capped model requests returned HTTP 200 as `gpt-5.5-2026-04-23`, with
explicit high reasoning, a 48,000-output-token ceiling and 600,000ms timeout.

| Request | Input tokens | Output tokens |
| --- | ---: | ---: |
| FAQ preparation | 8,877 | 5,550 |
| New draft | 11,122 | 14,258 |
| Independent critique | 27,322 | 16,188 |

The critic approved its semantic checks, but code found three question-heading
bindings incorrectly pointing at answer fields and source-derived counts of
274 / 282 / 270 / 183 against the unchanged 180-word per-page cap. Invalid
binding coverage makes the bounded repair baseline unusable. The worker correctly
reported failure, zero accepted drafts, zero validated artifacts and zero PRs.

Independent receipt review confirmed fresh identity-seeded execution, unchanged
facts across preparation, matching replay hashes and matching draft-to-critique
content. Raw HTML and the raw primary SERP payload are not stored in these compact
receipts; locale is corroborated by code/provenance rather than a complete raw
provider-request archive. These limits are not represented as stronger evidence.

State after the failed run: 22 runs, 36 failure records, `manualPilot: null`.
SHA-256: `cfe87d84b2c173d8acc488216831de1936251b518354b706f90e5cf14c011918`.
This candidate remains terminal at attempt one. No identities or retries were reset.

## Correction and its boundaries

Before a new independent critique, the worker can omit a redundant FAQ heading
binding only when all of the following hold:

- It points at the canonical answer location for one of the three FAQs.
- Its span exactly equals that FAQ's actual observed question, not answer text.
- It has no product claim; its only existing diagnostic is `span_mismatch`.
- It is unique, with valid selected and non-duplicate source fact IDs.
- Removing it leaves every actual answer sentence with valid exact coverage.

No public/private prose, question, answer, source inventory or valid answer binding
is edited. All other malformed bindings still fail. The original response remains
retained; the new critic request records received, schema-parsed and canonical
draft hashes plus removed original indices. The canonical draft drives fresh
manifests, independent review, counts and repair ceilings. Old verdicts are never
reused or relabelled as successful. Prompt instructions also explicitly exclude
observed question headings from authored claim bindings.

The unchanged-input offline boundary diagnostic removed only indices 64, 66 and
68: 81 bindings became 78. All authored text was unchanged. Structural mismatches
were resolved; two separate ambiguous product-reference findings remained for a
fresh independent review. This diagnostic made no model calls or state writes.

## Software verification

**2,508 tests across 58 files pass, with no failures or skips.** Lint, typecheck
and worker build pass; existing dependency build warnings remain.

The positive consumer-boundary regression failed before the correction. Thirteen
focused cases now cover ordinary output, reordered object keys, schema-normalized
whitespace, unknown/unselected facts, duplicate metadata/facts, wrong/noncanonical
locations, missing answer coverage, unobserved questions and actual answer text.

Independent review identified test typing and audit-hash naming issues; both were
corrected, including separate received/parsed/canonical hashes and regressions.
The independent bounded re-review was clean; no remaining findings.

## Paid retained-input repair diagnostic

`faq-metadata-live-diagnostic-2026-09-10` ran at `299ec90`. It reused the exact
captured research and original generated draft, not a fresh research/generation
run. Updated composition instructions were recorded; evidence and the generation
schema matched the original request. Code removed the three redundant heading
bindings before a new independent critique. No previous verdict was reused.

| Request | Input tokens | Output tokens |
| --- | ---: | ---: |
| Fresh critique | 27,080 | 15,251 |
| One bounded repair | 48,159 | 17,655 |
| Final independent verification | 24,715 | 15,116 |

All returned HTTP 200. Mechanical repair, final semantic verification and exact
source-use/growth checks passed. Final derived counts were **87 / 61 / 50 / 54**,
all below their captured 120-word ceilings and the 180-word hard limits. No new
semantic issues remained. The diagnostic reached native QA in an isolated clone
of lander `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.

Native `check:blog` and lint passed. The Next build correctly rejected
`secondaryKeywords: []`, which violates the lander's minimum-one contract. The
disposable checkout was cleaned up. The original lander, state and all previous
receipts were unchanged; no accepted native artifact or worker success resulted.

## Observed secondary-keyword serialization

Explicit candidate secondary keywords remain unchanged. When absent, the
materializer selects at most one distinct, on-topic query from captured
autocomplete or related-search evidence. That complete normalized phrase must
occur within a visible article span or FAQ question/title; no matching across
field boundaries or using private competitor-gap/source-inventory text.
Uncovered modifiers, unrelated queries and a duplicate primary keyword cannot
fill the field. With no suitable observation, materialization fails explicitly.

The captured template context contains the real autocomplete phrase `testimonial
video example`, which is covered by its visible FAQ and reviewed answer. This
fills metadata without changing the candidate identity, article copy, evidence,
metric status or approvals. It does not assert measured search volume.

Six new consumer regressions failed before correction. An initial assertion
expected the descriptive error instead of the error class's finding code; it was
corrected without changing the gate. Full verification now passes **2,514 tests
across 58 files**, zero failures/skips, plus lint, typecheck and worker build.
Independent focused review passed 493 content-bundle tests and eight additional
boundary probes, with no actionable findings. Existing build warnings remain.

## Saved-review native revalidation — passed

`template-native-revalidation-2026-09-10` ran at worker `3184aeb` against
lander `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. It reused the exact repaired
copy, independent verdict and captured source-use ceilings. No new research,
generation, model request, manual copy edit or persistent-state write occurred.

Clone, checkout, head resolution, isolation, install, native `check:blog`, lint,
build and workspace-integrity checks all exited zero. The disposable checkout
was cleaned up. Original repositories, earlier receipts and state were unchanged.

The resulting local `review-article.md` and `review-graphic.svg` are under
`artifacts/autoblogger/template-native-revalidation-2026-09-10/`. Status remains
`review`, all four approvals are false, no publication date is set, and the CTA
is `/download`. Markdown SHA-256:
`ad53e4726763d5cc0e3298cee06d202f8ee587b67e2ab90102364e78107c8052`.
Bundle hash: `8e5e0e6fe2371d1d4363e3b27f3e19ebfae98a23a82994bbfec073e404eca146`.

This proves saved-review materialization and native QA, **not** an uninterrupted
fresh worker run. It does not consume the pilot or authorize a lander PR.
The subsequent fresh examples attempt and discovery fix are recorded in
[bounded PAA completion](PAA-COMPLETION-PROOF-2026-09-10.md).
