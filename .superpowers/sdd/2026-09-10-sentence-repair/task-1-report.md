# Task 1 report: sentence-owned repair contract

Status: implemented, focused verification passed, self-reviewed; ready for the dependent integration task.

Requirements read: `task-1-brief.md` and `docs/superpowers/specs/2026-09-10-sentence-repair-design.md`.
Skills used: `superpowers:test-driven-development` (including its test-writing reference) and `superpowers:verification-before-completion`.
Branch retained: `automation/persistent-autoblogger-v1`; starting commit: `adf00cd`.
Commit subject: `feat(autoblogger): add sentence-owned repair contract`.

## Owned changes

- `lib/autoblogger/repair-patch.ts`: adds `createSentenceRepairRequest` and `applySentenceRepair`. The existing v1 implementation is unchanged (131 added lines, no removed lines).
- `lib/autoblogger/sentence-repair.test.ts`: 69 focused behavior tests using a real schema-valid draft and `buildRepairPolicy` with current binding hashes.
- This report. No other files are included in the Task 1 commit.

## Behavior and interfaces

The new request exposes the specified `schema`, `originalFingerprint`, `repairFields`, `repairLimits` and `sentenceFields` contract. Output is version 2 with every allowed location required. Code chooses modes; sentence keys use the original global binding index. Each sentence value is null or a bounded word array, inside a nullable strict field object.

Sentence mode requires uniquely occurring literal spans, non-overlap, whitespace-only uncovered ranges and conservative plain text. Formatted text, ambiguous bindings, unbound fields and the description character-expansion exception retain the original nullable v1 replacement schema, including local fact/product inventories.

Local validation accepts a single Unicode letter/number word with internal straight or curly apostrophes and optional trailing punctuation per item. Whitespace, hidden multiword tokens, hyphens, HTML, format controls and empty tokens fail closed. Provider item patterns remain ASCII-compatible `^\S+$`; local validation is stricter. Word bounds use the repair-policy Unicode tokenizer.

Assembly splices exact code-owned ranges in descending position order, rebuilds local bindings in their original order and inherits their original fact IDs and product ID. Null edits preserve original bytes; deletion removes only the selected binding. An all-null sentence object becomes a null v1 field. Empty whole-field replacements are rejected. The assembled patch is parsed with the existing local v1 shape and passed to `applyRepairPatch` for native draft, policy, delta and secret checks. This also catches secret-like text formed only after joining separate words.

## RED evidence

Before any implementation change, ran:

```text
npm test -- lib/autoblogger/sentence-repair.test.ts --maxWorkers=2
```

Observed exit 1: 1 test failed. Failure was `TypeError: ...applySentenceRepair is not a function`, at the required behavior call after the fixture passed `GeneratedDraftV2Schema.safeParse`. The expected edit was `Choose one buyer. Record the workflow.` with the original citations and original draft preserved.

Expanded the requirements cases before implementation and reran the same command: exit 1, 69 tests failed because the new exports were absent. Then implemented the contract and assembler. Following main's controller clarification about ordering, edited-field assertions check binding ownership/values and local order, not a fixed index in the assembled global binding array.

## GREEN evidence

- New-file run: exit 0, 69/69 tests passed; duration 2.12 seconds.
- Required focused regression command below: exit 0, 3 files and 230 tests passed; duration 3.88 seconds. Counts: sentence repair 69, v1 repair patch 91, repair policy 70.
- Focused ESLint on the two owned TypeScript files: exit 0, no diagnostics.
- Focused TypeScript compiler check with only the two owned files as roots (and their imports), repository compiler options, `noEmit: true`, `incremental: false`: exit 0, no diagnostics or generated files.
- `git diff --check`: clean.

```text
npm test -- lib/autoblogger/sentence-repair.test.ts lib/autoblogger/repair-patch.test.ts lib/autoblogger/repair-policy.test.ts --maxWorkers=2
./node_modules/.bin/eslint lib/autoblogger/repair-patch.ts lib/autoblogger/sentence-repair.test.ts
```

Coverage includes exact edited text and preserved IDs, frozen caller ownership, stable request keys, Unicode/apostrophes, maximum array sizes, malformed tokens, extra citation keys, missing keys, stale fingerprints, null byte-for-byte retention, single-sentence deletion and empty-field rejection. It also covers repeated/overlapping/nonliteral spans, links/emphasis/entities/HTML/code/autolinks/lists, mixed modes, local inventory/growth rejection, the description 200-character boundary, empty scope, secrets, accessors, inherited/hidden/symbol properties, prototype keys, sparse arrays and cycles.

## Self-review and concerns

No blocking interface ambiguity or known Task 1 defect remains. Reviewed the complete owned diff against the brief and checked the validation boundary, token limits, range ordering, caller ownership and failure messages. The original v1 exports and implementation remain unchanged; no generic pointer traversal or unrelated refactor was introduced.

Existing `applyRepairPatch` appends edited locations' bindings, so global `claimBindings` positions can change after a non-null repair. The original request's `bN` values must be interpreted against the original draft. Tests verify preserved values and local order, per main's controller clarification; downstream independent review must use the assembled draft.

`ready` here means deterministic patch assembly passed. Independent semantic/support review, exact sentence coverage, answer-length checks, reviewed source-growth checks and native QA remain downstream obligations. Integration, full-suite verification and the paid diagnostic are owned by main; this report makes no full-worker or article-acceptance claim.

No subagents, full test suite, paid calls, state/evidence changes, lander writes, production actions, branch switches or push were performed. Concurrent unowned work was left untouched.
