# FAQ metadata correction and fresh worker evidence — 10 September 2026

## Current outcome

The fresh template run completed automatic research, source retrieval, FAQ
preparation, generation and independent critique. It failed before repair and
native QA. The invalid FAQ metadata that prevented repair is now corrected in
code and reproduced against the unchanged captured draft. **A successful
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
The follow-up paid retained-input repair diagnostic, if run, must be reported
separately from a new whole-worker proof.
