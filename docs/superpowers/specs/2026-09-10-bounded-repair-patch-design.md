# Bounded repair output contract

The live semantic FAQ run succeeded through research, preparation, drafting and
independent critique, then failed its repair delta check. The full-object repair
response retained most prose but only 40 of 132 bindings, changed immutable
bindings and transferred evidence. Do not reset this failed run or weaken checks.

Selected correction: structured field replacements. Prompt-only clarification
still asks the model to reproduce immutable material; post-hoc acceptance of
missing bindings would hide errors. Instead, the normal prepared-context path
asks for only allowed text-field replacements and their complete local bindings.
Code copies immutable text/structure/bindings from the original and applies only
explicit replacements before running every existing delta/content/critic gate.

The root output is version 1, originalFingerprint, and a changes object with one
required key per allowed JSON-pointer location. Each value is null (unchanged) or
{text, bindings: [{span, sourceFactIds, productClaimId}]}. Schema enums restrict
fact/product IDs per original location. There is no model-supplied location field
inside a binding. Null preserves the complete original field/binding set. A changed
field supplies all of its bindings. Unknown keys, stale original fingerprint,
unsafe paths, secret-like values and invalid scope are rejected, not repaired.

The assembler returns a cloned GeneratedDraftV2 or blocking findings. It invokes
the existing inspectRepairDelta; no word, evidence, copying, product or source-use
limit is loosened. The independent verifier reviews all assembled bindings.

Use the patch format only when the context has a validated FAQ preparation receipt;
legacy direct drafting remains readable/testable with its existing full-object
repair contract. Normal worker execution always prepares evidence. Still one repair,
at most five GPT-5.5 requests, no fallback model or automatic extra attempt.

Tests cover preservation, valid bounded edit, null/no-op, malformed/secret/stale
input, unsafe paths, fact expansion, immutable bindings and incomplete coverage.
Integration tests cover normal prepared context → patch → independent verifier and
offline native QA. Current saved failed repair remains failed, never rewritten.
Only worker PR #1 changes. No publishing, lander source edits, schedule or production.
