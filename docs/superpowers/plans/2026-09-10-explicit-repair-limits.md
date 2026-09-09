# Explicit Repair Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Supply every existing numeric delta bound to the repair generator.
**Architecture:** One pure helper shares the validator's actual rendering/accounting
functions; the patch request includes its result, without changing validation.
**Tech Stack:** TypeScript, Vitest, existing Structured Outputs client.
**Spec:** docs/superpowers/specs/2026-09-10-explicit-repair-limits-design.md

## Global Constraints

- Worker branch/PR #1 only. No lander, state, original receipt or production edits.
- No gate relaxation, paid request, extra repair, model or schema-output change.

### Task 1: Exact constraints in repair requests

Files: repair-policy.ts/test.ts, repair-patch.ts/test.ts, drafting.ts/test.ts under
lib/autoblogger. No other implementation files.

Interface:
```ts
getRepairLocationLimits(original: GeneratedDraftV2, policy: RepairPolicy):
  Record<string, {
    maxRenderedWords: number;
    maxCharacters: number | null;
    maxBoundWordsByFact: Record<string, number>;
    allowedCitationUrls: string[];
  }>;
```

- [x] Write failing consumer tests for repairRequest.input.repairLimits: Markdown
  link destinations excluded from rendered words, repeated span occurrences
  counted, duplicate fact IDs not multiplied, Unicode/apostrophes counted by the
  existing tokenizer; exact description exception; stale baseline rejected.
```ts
expect(request.input.repairLimits[location].maxBoundWordsByFact['fact-a']).toBe(6);
```
- [x] Implement helper with rendered(text, location) and boundCoverage(tokens,
  original bindings); reject invalid/stale baseline via inspectRepairDelta on
  original/original. Return only policy.allowedLocations without mutation.
- [x] Include repairLimits in createRepairPatchRequest input and type. Use the
  patch prompt to explicitly require cumulative per-fact limits and unchanged
  entire citation sets. Output schema, assembler and acceptance gates unchanged.
- [x] Verify a generated prepared-path request forwards actual limits. Run focused
  policy, patch, drafting and offline tests; lint/typecheck. Commit only six scoped
  implementation files. Independent review, then main full checks/docs/push.
