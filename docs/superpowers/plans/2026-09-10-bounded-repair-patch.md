# Bounded Repair Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Prevent the repair generator from losing untouched article evidence.
**Architecture:** Structured permitted-field replacements assembled onto the original;
all existing delta, content and independent review gates stay authoritative.
**Tech Stack:** TypeScript, Zod, Structured Outputs, Vitest.
**Spec:** `docs/superpowers/specs/2026-09-10-bounded-repair-patch-design.md`

## Global Constraints

- Worker PR #1 only. No publishing, lander edits, production or schedules.
- No state/retry reset, manually injected evidence or modified historical responses.
- GPT-5.5, one bounded repair, at most five requests; no fallback.
- Keep every source-use, evidence, product, media and native validation gate.

### Task 1: Pure patch schema and assembler

Files: create only `lib/autoblogger/repair-patch.ts` and `repair-patch.test.ts`.

Interfaces:
```ts
createRepairPatchRequest(original: GeneratedDraftV2, policy: RepairPolicy):
  {schema: JsonSchema; input: {originalFingerprint: string; repairFields: Record<string, unknown>}};
applyRepairPatch(original: GeneratedDraftV2, policy: RepairPolicy, output: unknown):
  {status:'ready'; draft:GeneratedDraftV2} | {status:'blocked'; findings:DraftSafetyFinding[]};
```

- [ ] Write public tests first, then confirm failures. Synthetic valid original and
  policy: null fields preserve exact text and bindings; a supported shrinking edit
  with complete local bindings succeeds; unknown locations/facts, stale fingerprint,
  prototype paths, missing fields, unsafe values and incomplete coverage fail.
```ts
expect(applyRepairPatch(original, policy, validPatch).status).toBe('ready');
expect(applyRepairPatch(original, policy, wrongFingerprint).status).toBe('blocked');
expect(original).toEqual(before);
```
- [ ] Strict provider/local schema: object root, schemaVersion 1,
  originalFingerprint matching policy, changes object with exact required allowed
  keys; each key null or text+bindings. Bindings contain span, nonempty local-only
  sourceFactIds, nullable original-local productClaimId. Never include unbound local
  facts or unconstrained extra fields. Input presents original text/bindings per key.
- [ ] Reject invalid original/policy before requests. Reuse inspectRepairDelta on
  original/original to validate policy fingerprint and on assembled output; preserve
  every immutable binding. Reconstruct only safe known scalar text leaves in a
  clone; no generic prototype-capable pointer writes. GeneratedDraftV2Schema validates
  assembled structure. Fail closed with generic safe findings on parsing/secrets.
- [ ] Run focused tests/lint and commit only assigned two files. Report red/green.

### Task 2: Normal-path integration

Files: drafting.ts, drafting.test.ts, offline-e2e.test.ts.
- [ ] Prepared-context repair uses request name `videoclaw_article_repair_patch_v1`,
  Task1 schema/input, a patch-specific system prompt and the same original context,
  issues/source plan/policy. Legacy direct draft retains old full-object request.
```ts
const patch = createRepairPatchRequest(initial, repairPolicy);
const output = await client.generate({name:'videoclaw_article_repair_patch_v1',
  schema:patch.schema, system:patchPrompt, input:{...repairInput,...patch.input}});
const assembled = applyRepairPatch(initial, repairPolicy, output);
```
- [ ] No fallback or second repair. On blocked return findings. On ready, existing
  content/delta checks and independent verification use assembled full draft.
- [ ] Tests prove immutable bindings survive, forbidden patch blocks before verifier,
  legitimate patch still requires independent verdict. Adapt only external fixture
  output to the new request; native checks remain real.
- [ ] Full tests/lint/typecheck/build, independent review, compact checkpoint.
  Diagnose current saved failure without changing state or claiming fresh success.
  No additional paid run until this contract is verified.
