# Task 3 Final Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Do not dispatch subagents for this task.

**Goal:** Close the final Task 3 review findings with fail-closed repair verification, exact claim grounding, non-bypassable materialization, media revalidation, and Unicode-format-control rejection.

**Architecture:** Keep `createStructuredDrafter()` as the only workflow entry point while retaining defense-in-depth checks in the bundle assembler. Version the post-repair verifier separately from the initial critique so its schema must account for every original issue ID, and centralize source/checked-source/media validation in `content-bundle.ts` for both orchestration and direct-call coverage.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 4, unified/remark Markdown AST, native Responses API adapter.

**Spec:** `.superpowers/sdd/2026-09-04-videoclaw-persistent-autoblogger-v1/task-3-brief.md` plus the final Task 3 review in the current user request.

## Global Constraints

- Work only in `work/videoclaw-autoblogger-v1`; do not write to the lander or production branches.
- Use strict red-green TDD for each behavior.
- Keep one repair maximum, no model fallback, and no live API calls in tests.
- Leave the pre-existing untracked `package-lock.json` unstaged.

---

### Task 1: Issue-accounting post-repair verification

**Files:**
- Modify: `lib/autoblogger/drafting.ts`
- Test: `lib/autoblogger/drafting.test.ts`

**Interfaces:**
- Consumes: initial `DraftCritiqueV1.issues`, repaired `GeneratedDraftV2`.
- Produces: strict repair-verification output with one evaluation per original issue ID and zero unresolved/new issues for approval.

- [ ] Add fixture tests where the verifier omits an original issue, resolves every original issue, or reports an unresolved/new issue; assert blocked/ready outcomes and exactly one repair call.
- [ ] Run the focused verifier tests and observe failures caused by the current generic second critique.
- [ ] Add a dedicated strict repair-verification schema and send `{ originalIssues, repairedDraft }` in the second critique request.
- [ ] Require exact original-ID coverage, resolved evaluations only, no new issues, and approved consistency; rerun focused tests to green.

### Task 2: Exact claim grounding and broader detection

**Files:**
- Modify: `lib/autoblogger/content-bundle.ts`
- Test: `lib/autoblogger/content-bundle.test.ts`

**Interfaces:**
- Consumes: visible generated sentences and selected SourceFact claim text.
- Produces: `content.claim_binding` unless each factual/modal/product/outcome claim exactly normalizes to one approved fact.

- [ ] Add regressions for `A backup recording can protect the pitch.`, additional modal forms, and a longer assertion bound to a shorter fact.
- [ ] Run those tests and observe the current detector/containment logic accepting them.
- [ ] Broaden claim detection to modals and objective clauses while allowing only genuinely nonfactual imperatives; replace containment with exact normalized equality.
- [ ] Update valid fixtures only where their approved fact text must equal the complete visible claim, then rerun the grounding suite to green.

### Task 3: Materialization trust boundaries

**Files:**
- Modify: `lib/autoblogger/content-bundle.ts`
- Test: `lib/autoblogger/content-bundle.test.ts`

**Interfaces:**
- Consumes: `DraftingContext.checkedSources`, selected source references, and one media object.
- Produces: a bundle only when selected sources are exactly distinct, reachable normalized checked final URLs and media reparses through the allowlist schema.

- [ ] Add direct materialization regressions for an unchecked source final URL and traversal/malformed media.
- [ ] Run them and observe unsafe serialization.
- [ ] Extract shared checked-source validation and invoke it from materialization; parse media with `AllowlistedProductMediaSchema` before serialization.
- [ ] Ensure serialized sources are exactly the selected checked final URLs and rerun direct-call tests to green.

### Task 4: Unicode visible-label hardening

**Files:**
- Modify: `lib/autoblogger/content-bundle.ts`
- Test: `lib/autoblogger/content-bundle.test.ts`, `lib/autoblogger/drafting.test.ts`

**Interfaces:**
- Consumes: source labels and media-visible labels/captions.
- Produces: preflight rejection for Unicode category `Cf` and existing control characters.

- [ ] Add source-label and media-label regressions using synthetic bidi/format controls.
- [ ] Run them and observe acceptance.
- [ ] Extend the shared security-sensitive text predicate to reject `\p{Cf}` and apply it to visible media fields.
- [ ] Rerun focused tests to green.

### Task 5: Report, verification, and commit

**Files:**
- Modify: `.superpowers/sdd/2026-09-04-videoclaw-persistent-autoblogger-v1/task-3-report.md`

**Interfaces:**
- Produces: third fix report and one scoped feature-branch commit.

- [ ] Run targeted Task 3 tests.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`; inspect the lander status read-only.
- [ ] Append exact RED/GREEN and verification evidence to the Task 3 report.
- [ ] Stage only scoped files, verify the staged diff, commit, and confirm only the pre-existing lockfile remains untracked.

## Self-review

- Every review item maps to one task and an observable regression.
- The verifier schema makes omission detectable without trusting model-authored predicates.
- Exact fact equality closes longer-assertion piggybacking.
- Direct materialization retains defense-in-depth even if its module export remains available for testing.
- Media and Unicode checks occur before serialization; no lander or network mutation is required.
