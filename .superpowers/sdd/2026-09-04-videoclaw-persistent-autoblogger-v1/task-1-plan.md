# Task 1: Incremental opportunity domain and state implementation plan

**Goal:** Provide versioned, pure autoblogger contracts and policies that safely intake existing matrices, select eligible opportunities, and persist compact idempotent state for later Tasks 2–5.

**Architecture:** `lib/autoblogger/domain.ts` owns Zod-backed data contracts and canonical normalization/fingerprints. `lib/autoblogger/matrices.ts` parses the three existing matrix layouts into normalized candidates without count assumptions. `lib/autoblogger/policies.ts` owns duplicate screening, eligibility, scoring, caps, and run-mode gates; `lib/autoblogger/state.ts` owns compact, legal state transitions. `DraftBundle` validates only its worker envelope and opaque generation DTO; the lander remains the final publication validator.

**Tech stack:** TypeScript, Zod 4, Vitest 4.

**Spec:** `.superpowers/sdd/2026-09-04-videoclaw-persistent-autoblogger-v1/task-1-brief.md` and `.superpowers/sdd/2026-09-04-videoclaw-persistent-autoblogger-v1.md`.

## Global constraints

- Work only on `automation/persistent-autoblogger-v1` in the supplied isolated worktree.
- New production modules live under `lib/autoblogger/`; no legacy collector or lander changes.
- Test each behavior first, observe its focused failing output, add only the minimal production code, then observe focused green output.
- A run scans at most 50 candidates, deeply inspects at most 10, drafts at most 3, and selects at most 2 candidates for one ICP.
- Manual pilot mode may use pending metrics and drafts exactly 1 artifact; scheduled mode rejects pending or incomplete volume/difficulty metrics.
- No exactly-50 or exactly-250 input requirement is allowed in new-worker code.
- `DraftBundle` must not duplicate the lander publication validator.

---

### Task 1: Define portable domain contracts and canonical identity

**Files:**
- Create: `lib/autoblogger/domain.test.ts`
- Create: `lib/autoblogger/domain.ts`

**Interfaces:**
- Produces: `CandidateSchema`, `EvidenceBundleSchema`, `KeywordMetricsSchema`, `DraftBundleSchema`, `RunRecordSchema`, canonical normalization functions, and candidate fingerprint helpers.

- [ ] Write a failing test proving punctuation/case/diacritic collisions normalize to the same keyword, title, slug, and intent identities.
- [ ] Run `npm test -- lib/autoblogger/domain.test.ts` and record the expected missing-module failure.
- [ ] Implement the smallest versioned schemas and pure canonicalization/fingerprint helpers needed by the test.
- [ ] Run the focused test and record green output.
- [ ] Add focused RED/GREEN cycles for a permissive `DraftBundle` generation DTO and deterministic, metadata-only `RunRecord` validation.

### Task 2: Intake candidates from every current matrix shape

**Files:**
- Create: `lib/autoblogger/matrices.test.ts`
- Create: `lib/autoblogger/matrices.ts`

**Interfaces:**
- Consumes: canonical candidate helpers from `domain.ts`.
- Produces: `intakeMatrixCandidates(markdown, campaignId)` and `intakeCampaignMatrices(inputs)`.

- [ ] Write a failing test using minimal wide-table, field-table, and labeled-section fixtures, including a collision and a matrix with fewer than 50 candidates.
- [ ] Run `npm test -- lib/autoblogger/matrices.test.ts` and record RED output.
- [ ] Implement only the three parsers and global dedupe needed to produce normalized candidates.
- [ ] Run the focused test and record GREEN output.

### Task 3: Add duplicate, eligibility, scoring, caps, and mode gates

**Files:**
- Create: `lib/autoblogger/policies.test.ts`
- Create: `lib/autoblogger/policies.ts`

**Interfaces:**
- Consumes: `Candidate`, `EvidenceBundle`, `KeywordMetrics`, and identities from `domain.ts`.
- Produces: duplicate-screening, eligibility, scoring, bounded deterministic selection, and `createRunRecord` policies.

- [ ] Write focused failing tests for duplicate sources (backlog, persistent state, lander, and open PR), missing evidence signals, pending metrics, ranking tie-breaks, top-three selection, per-ICP cap, manual one-artifact cap, scheduled rejection, and variable candidate count.
- [ ] Run `npm test -- lib/autoblogger/policies.test.ts` and record RED output.
- [ ] Implement pure policy functions with explicit rejection reasons and deterministic ordering.
- [ ] Run the focused test and record GREEN output.

### Task 4: Add compact idempotent persistent state transitions

**Files:**
- Create: `lib/autoblogger/state.test.ts`
- Create: `lib/autoblogger/state.ts`
- Create: `lib/autoblogger/index.ts`

**Interfaces:**
- Consumes: fingerprints and `RunRecord` from `domain.ts`.
- Produces: `AutobloggerStateSchema`, `transitionCandidateState`, and one public module entry point.

- [ ] Write failing tests for successful progression, idempotent repeat events/reruns, compact state records, and illegal state jumps.
- [ ] Run `npm test -- lib/autoblogger/state.test.ts` and record RED output.
- [ ] Implement the smallest append/replace-free transition policy and public exports.
- [ ] Run the focused test and record GREEN output.

### Task 5: Verify and hand off

**Files:**
- Create: `.superpowers/sdd/2026-09-04-videoclaw-persistent-autoblogger-v1/task-1-report.md`

- [ ] Run all new focused tests together, then `npm test` for the complete suite.
- [ ] Inspect `git diff --check`, the staged diff, and the requirements line by line; record self-review and concerns.
- [ ] Write the report with implementation, test output, RED/GREEN evidence, files changed, self-review, and concerns.
- [ ] Commit only Task 1 files with a focused message on `automation/persistent-autoblogger-v1`.
