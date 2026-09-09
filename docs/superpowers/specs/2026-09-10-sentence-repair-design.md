# Sentence-owned bounded repair

## Problem and evidence

Two paid field-patch diagnostics preserved immutable material but failed word-accounting checks. Explicit numeric guidance did not fix this. The saved testimonial draft has 105 editable bindings across 20 locations; all have unique, non-overlapping literal positions and whitespace-only gaps. Asking the model to recreate whole fields and citation bindings introduces avoidable metadata and counting errors.

This change keeps the full engineering milestone: automatic research → drafting → critique/one repair → native QA → review-only artifact. A retained-input repair diagnostic is not that milestone.

## Design

Introduce a version-2 repair patch for FAQ-prepared drafts. Before the request, code assigns each allowed field either `sentences` or `field` mode. The model cannot choose the mode.

- Sentence mode is permitted only for nonempty bindings whose literal spans occur exactly once, do not overlap, cover every non-whitespace character, and contain no Markdown/HTML/link/entity syntax. Use a conservative text allowlist; ambiguous or formatted text stays in field mode. Description character-expansion exceptions stay in field mode.
- Ordinary straight double quotes and curly double quotes in the original are plain text, not Markdown syntax: allow them during original-field classification without stripping or altering the original text/ranges. Replacement word tokens remain strict. Worksheet underscores stay in full-field mode.
- Sentence keys are stable `b<original claimBindings index>` values. Each output value is null (retain), an empty array (delete), or an array of replacement words. Each array has at most the original span's word count. Provider item pattern is `^\\S+$`; local validation requires exactly one Unicode letter/number word, optional internal straight/curly apostrophes, and optional trailing `. , ! ? ; :`. This local check rejects hyphens, whitespace, Markdown and disguised multiword tokens. It does not assume the provider supports Unicode regex properties.
- Code joins replacement words with spaces, replaces only the exact original range, and retains that binding's original fact IDs and product ID. It never asks the model to assign these IDs in sentence mode. Deletions remove only that binding. All unchanged bytes and bindings are preserved.
- Empty whole-field output is rejected. Direct-answer length, exact sentence coverage, copied passages, secrets, product claims and semantic support retain the existing downstream checks. Sentence edits do not grant approval or waive those checks.
- Complex fields use the existing nullable full-field replacement shape, including local fact/product enums and the existing source/word constraints, inside the same request. No extra model call or silent fallback retry.
- Assemble a v1 field patch and pass it through `applyRepairPatch`; reuse the existing JSON-input, original-fingerprint, policy, field, source-growth and secret validation rather than duplicating it.
- Request name: `videoclaw_article_repair_patch_v2`. Old direct callers without FAQ preparation continue using their existing full-draft repair path.

Array bounds and string patterns are supported by [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). A tiny live probe accepted bounded word arrays; a separate Unicode-property regex schema was rejected. These probes are schema feasibility only, not article acceptance.

## Constraints

- Worker branch only; no production, lander, PR55, schedule, publication or generated-PR changes.
- Keep `gpt-5.5`, one bounded repair and independent final verification; no model fallback.
- Keep original saved evidence and terminal candidate state unchanged.
- Never commit keys, page bodies, raw model responses or private article receipts.
- No relaxation of evidence, source budget, publication or native QA gates.

## Verification

Unit tests prove fixed citation ownership, bounded words, null/deletion behavior, unchanged bytes, safe-mode selection, complex-field compatibility, malformed/hostile outputs and stale fingerprints. Normal-path tests prove the prepared workflow selects v2, malformed edits block before final verification, and unresolved evidence still fails after verification. One bounded paid repair diagnostic may reuse hash-verified context/draft/critique; report it as a component test and preserve all historical failures. A real full worker proof is still required.
