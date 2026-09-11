# Voice-over worker attempt and procedure-context correction

## Fresh whole-worker attempt: failed before native QA

`voiceover-live-proof-2026-09-12` ran on `b02ee23`, with publication disabled. It automatically collected eight organic results and twelve Google questions, fetched supporting page bodies, completed source relevance and three-question FAQ preparation, generated a draft, ran independent critique, applied one bounded repair and completed independent final verification. All six configured model requests completed. No manual facts or article rewriting were supplied.

The final verifier approved the repaired text, all support evaluations and the editorial checks. The worker nevertheless failed one deterministic `unapproved_product_reference` check before native QA. The conditional instruction about a failed audio sample had an exact ordinary subject three steps earlier in the same numbered procedure. The checker retained only the previous two sentences, while the independent reviewer had correctly quoted the earlier visible subject.

The failed attempt is preserved. Current state: **38 runs / 62 failures**, 499 queued candidates, no successful pilot. This is not an accepted fresh whole-worker run.

Provenance: Google `C6iRfdPqmwOiAlZTm` / `m4OVTO9EbNS3cRYYL`; PAA `rmRJTnEMOqm4MvB34` / `CaDrMgiccxTlhUKbn`.

## Correction and verification

Reference context now retains the visible prefix of the enclosing top-level numbered Markdown procedure, alongside the existing local context. It does not borrow future steps, another list, other paragraphs, FAQs or private campaign metadata. A current independent non-product review, exact visible subject, binding/context hashes and the explicit-product veto remain required. Claim support, source budgets, copying checks, approval flags and retry limits are unchanged.

The context is extracted from the already-parsed Markdown node. An independent review caught that reparsing a detached list lost reference definitions; three failing regressions reproduced hidden product aliases, hidden labels and linked targets before that correction. Seven new regressions cover ordinary procedure references and those boundaries. Final independent recheck found no actionable issues and passed 525 focused tests.

Full verification: **2,820 tests across 63 files**, zero failures/skips; lint, typecheck and worker build passed. Existing Vinext dynamic-import warnings remain.

## Saved-response native revalidation: passed, not fresh proof

`artifacts/autoblogger/voiceover-native-final-2026-09-12/` replays the exact four captured drafting/review responses. Request comparison permits only the added visible procedure context in reference manifests; all other request fields must match. Original text, verdicts, facts, IDs and hashes are unchanged, and both old/new manifests are retained. No new model requests or research occurred.

The complete drafting/repair gates pass under the corrected code. The real publisher then validated the resulting bundle in an isolated lander checkout at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`: **32 native blog tests**, lint, build and workspace integrity all passed. The receipt confirms unchanged persistent state, original run receipts and worker/lander checkout during revalidation.

Private outputs are `review-article.md` (900 whitespace-delimited body words) and `review-graphic.svg` (1200×675). The article is **How to Record a Voice Over for a Marketing Video**, with `status: review`, all approvals false, no `publishedAt`, `/download` CTA, approved kinetic-type product media, four visible sources and three observed FAQs. Paid keyword metrics remain provider-pending.

## Remaining proof and boundaries

A new uninterrupted automatic research → draft → critique/repair → native-QA run is still required. These saved-response results do not relabel the failed worker attempt. No original lander edits, PR #55 changes, generated lander PRs, publication, merge, deployment, indexing or schedule activation occurred. Team-controlled publishing credentials and paid metrics remain separate dependencies.
