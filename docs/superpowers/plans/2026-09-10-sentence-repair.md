# Sentence-owned Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove citation reconstruction and cumulative counting from safe sentence edits while preserving all article acceptance gates.

**Architecture:** Build a hybrid v2 patch using the validated existing v1 contract. Code chooses sentence or full-field mode before the single repair request; sentence edits inherit their original citations. Integration changes only FAQ-prepared drafts.

**Tech Stack:** TypeScript, Zod, Vitest, OpenAI structured JSON.

**Spec:** `docs/superpowers/specs/2026-09-10-sentence-repair-design.md`

## Global Constraints

- Worker branch only; no production, lander, PR55, schedule, publication or generated-PR changes.
- Keep `gpt-5.5`, one bounded repair and independent final verification; no model fallback.
- Keep original saved evidence and terminal candidate state unchanged.
- Never commit keys, page bodies, raw model responses or private article receipts.
- No relaxation of evidence, source budget, publication or native QA gates.

### Task 1: Hybrid contract and deterministic assembly

**Files:** Modify `lib/autoblogger/repair-patch.ts`; create `lib/autoblogger/sentence-repair.test.ts`.

**Interfaces:**

```ts
export function createSentenceRepairRequest(original: GeneratedDraftV2, policy: RepairPolicy): {
  schema: JsonSchema;
  input: {
    originalFingerprint: string;
    repairFields: Record<string, unknown>;
    repairLimits: ReturnType<typeof getRepairLocationLimits>;
    sentenceFields: Record<string, {
      mode: 'sentences';
      sentences: Record<string, {span: string; maxWords: number; sourceFactIds: string[]; productClaimId: string | null}>;
    } | {mode: 'field'}>;
  };
}
export function applySentenceRepair(original: GeneratedDraftV2, policy: RepairPolicy, output: unknown):
  {status: 'ready'; draft: GeneratedDraftV2} | {status: 'blocked'; findings: DraftSafetyFinding[]};
```

Consumes the existing private `contract`, `assertJson`, `textLeaves` helpers and public `applyRepairPatch`. Retain v1 exports and behavior. The new output root is `{schemaVersion:2,originalFingerprint,changes}` with every allowed location required. For sentence fields the value is null or a strict object with every `bN` key required, each null or a bounded string array. For field mode use the old nullable replacement schema unchanged. Return a safe generic invalid-patch finding for malformed data, never model text.

- [x] Write a failing behavior test using a real GeneratedDraftV2 fixture and buildRepairPolicy. For `Choose one buyer problem. Record the workflow.` with bindings at indices 0 and 1, submit `{b0:['Choose','one','buyer.'], b1:null}`. Assert exact text `Choose one buyer. Record the workflow.` and unchanged fact/product IDs. Also assert the original is unchanged.

```ts
expect(result).toMatchObject({status:'ready', draft:{sections:[
  {markdown:'Choose one buyer. Record the workflow.'},
]}});
expect(result.status === 'ready' && result.draft.claimBindings[0]).toMatchObject({
  span:'Choose one buyer.', sourceFactIds:['fact-a'], productClaimId:null,
});
```

- [x] Run `npm test -- lib/autoblogger/sentence-repair.test.ts --maxWorkers=2`; observe missing-feature failure before implementation.
- [x] Add the pure contract/assembler with conservative safe-text mapping. Count words with the same Unicode word definition as repair-policy. Check unique exact occurrences, non-overlap, and whitespace-only uncovered ranges. Use existing contract's local v1 shape for final validation; do not create generic pointer traversal. Construct candidate v1 replacements from code-owned ranges and citations and call `applyRepairPatch`.

```ts
const words = span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
// Replacement arrays are joined only after strict local item validation.
// Splice ranges descending; reconstruct local bindings in original order.
return applyRepairPatch(original, policy, assembledV1Patch);
```

- [x] Test oversized arrays; embedded multiword/hyphen/HTML tokens; unicode/apostrophes; added citation keys; missing sentence keys; stale fingerprint; null byte preservation; permitted single-sentence deletion; rejected empty whole field; repeated/overlapping/nonliteral spans selecting full-field mode; links/emphasis/entities selecting full-field mode; old description expansion; secret/accessor/prototype rejection. Tests must assert outcomes and preserved values, not only request names.
- [x] Run new tests plus `repair-patch.test.ts` and `repair-policy.test.ts`; record results, self-review, commit only owned files.

### Task 2: Prepared workflow integration

**Files:** Modify `lib/autoblogger/drafting.ts`, `lib/autoblogger/drafting.test.ts`, `lib/autoblogger/offline-e2e.test.ts`.

**Interfaces:** Consume `createSentenceRepairRequest`/`applySentenceRepair` from Task 1; existing nonprepared workflow unchanged. `sentenceFields` is included with `repairLimits` in the repair input.

- [x] Update the prepared fixture's nullable patch version to 2 and request expectation to `videoclaw_article_repair_patch_v2`. Add a fixture repair using a shorter FAQ word-array edit; verify final review receives that edit and original citations. Keep the unresolved-support fixture failing after independent verification. Run focused tests to observe failure against v1 integration.

```ts
const patchRequest = context.faqEvidencePlan ? createSentenceRepairRequest(initial, repairPolicy) : null;
// The same single repair request and same verifier follow.
const assembled = applySentenceRepair(initial, repairPolicy, repairOutput);
```

- [x] Wire the interfaces into the prepared path. Update system instructions: code-selected mode; `bN` null retains; arrays contain one word per item; empty deletes but required fields/minimum answer lengths must remain; sentence IDs own fixed source/product references; full-field mode retains old explicit limits. Do not remove original issues/source plans or any downstream checks.
- [x] Adapt offline-e2e fixture output to support sentence-mode edits through real assembly, not a bypass. Verify malformed edits create no bundle and trigger no final verification; unknown/unprepared legacy behavior stays covered.
- [x] Run `npm test -- lib/autoblogger/drafting.test.ts lib/autoblogger/offline-e2e.test.ts --maxWorkers=2`, self-review and commit only owned files.

### Task 3: Verification and truthful evidence handoff

**Files:** New proof document under `docs/autoblogger/`; update current README/VERIFICATION references only if supported by results. Private diagnostic artifacts remain ignored.

- [x] Run `npm test -- --maxWorkers=2 --reporter=json --outputFile=artifacts/autoblogger/sentence-repair-verification-2026-09-10/tests.json`, then lint, typecheck and build. Record exact counts/warnings, not historical values.
- [x] Review the implementation diff with an independent reviewer and fix actionable defects before paid verification.
- [x] Adapt the existing ignored explicit-limits diagnostic harness to a new ignored directory and the new v2 request name. Retain exact saved context/draft/critic, verify their hashes, cap at one new repair plus one final verification, and leave state SHA unchanged. Only invoke native lander validation if the real drafter returns ready. No state reset or generated PR.
- [x] Record result with model/token/provenance and clear component-versus-full-worker distinction. Correct the earlier feasibility receipt interpretation: the word-array response tokens each count as one; its probe logging regex was overescaped. Preserve the original receipt.
- [x] Commit code/docs and push the existing worker feature branch. Never report full engineering completion unless an actual automatic worker article reaches native QA without injected evidence or writing.

## Outcome

Mechanical repair is implemented and independently reviewed. The paid component
test passed assembly/delta checks but final editorial verification blocked source
overuse and two retained caption assertions. No native article QA or full-worker
success occurred. See `docs/autoblogger/SENTENCE-REPAIR-PROOF-2026-09-10.md`; the
larger automatic-article milestone remains open.
