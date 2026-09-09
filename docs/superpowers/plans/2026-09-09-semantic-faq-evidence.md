# Semantic FAQ Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Prove the automatic artifact-only article pipeline with semantically grounded FAQ selection.

**Architecture:** A bounded structured preparation call proposes three observed FAQs
with exact source-body anchors. Mechanical validation binds the proposal to immutable
research. Existing independent article review remains the semantic acceptance gate.

**Tech Stack:** TypeScript, Zod, Vitest, existing OpenAI Responses client and native lander validator.

**Spec:** `docs/superpowers/specs/2026-09-09-semantic-faq-evidence-design.md`

## Global Constraints

- Worker branch `automation/persistent-autoblogger-v1` only; original lander/PR55 read-only.
- No publishing, production, scheduling, retry reset, invented metrics or manual evidence injection.
- Exact `gpt-5.5`, at most five model requests and one repair.
- Raw bodies/model outputs/runtime credentials stay in ignored private artifacts.
- Maintain all existing product, source-use, media and native-contract checks.

### Task 1: Checked semantic preparation module

**Files:** Create `lib/autoblogger/faq-preparation.ts` and `faq-preparation.test.ts` only.

**Interfaces:**

```ts
type FaqEvidencePlan = {
  schemaVersion: 1;
  contextHash: string;
  candidateQuestions: string[];
  selections: Array<{ question: string; intent: string;
    anchors: Array<{ sourceFactId: string; excerpt: string }> }>;
};
type PreparedFaqContext = DraftingContext & { faqEvidencePlan: FaqEvidencePlan };
function prepareFaqEvidence(context: DraftingContext, client: StructuredOutputClient,
  candidateQuestions: readonly string[]): Promise<PreparedFaqContext>;
function validateFaqEvidencePlan(context: DraftingContext, plan: unknown):
  Array<{question: string; sourceFactIds: string[]}>;
```

- [ ] Write failing tests against these public functions. Real context/receipt
  fixtures must prove alternate definition wording is accepted only with a literal
  body anchor; altered source text, unknown questions/facts, repeated intent/key,
  short/fabricated/heading-only excerpts and insufficient output are rejected.

```ts
await expect(prepareFaqEvidence(context, fixtureClient(insufficient), questions))
  .rejects.toThrow(/insufficient/i);
expect(() => validateFaqEvidencePlan(changedBodyContext, validPlan)).toThrow();
```

- [ ] Implement the standalone module. One request named `videoclaw_faq_evidence_v1`;
  response has `status: ready|insufficient_evidence`, `contextHash`, `reason` and
  `selections`. Strict JSON schema; ready requires three selections, insufficient
  requires zero. Schema-constrain question and body-fact IDs to supplied inventories.
  Question pool must be 3–9 distinct observed strings. Each selection has 1–3 anchors,
  each exact body excerpt 30–600 characters and a nonblank intent ≤80 characters.
  Validate before/after request; reject secret-like input/output. Compute SHA-256
  over candidate, evidence.signals, provenance, sourceFacts, checkedSources,
  keywordMetrics and generatedAt. Do not include preliminary selected FAQ fields.
  No imports from runtime or calls to any live service in tests.
- [ ] Return a cloned context with selected questions in evidence.faqQuestions and
  evidence.serp.peopleAlsoAsk; attach receipt. Validation checks exact question
  order against both lists and never mutates original input.
- [ ] Run `npx vitest run lib/autoblogger/faq-preparation.test.ts --maxWorkers=2`.
  Commit only the two module files, with test-first evidence in the task report.

### Task 2: Worker, drafting and audit integration

**Files:** `content-bundle.ts`, `drafting.ts`, `research.ts`, `worker.ts`,
`local-replay-audit.ts`, `local-pilot.ts` and their covering tests.

- [ ] Add an optional typed receipt to DraftingContext. Export the existing
  `rankRelevantPaaQuestions` for bounded pool selection; keep its provenance checks.
- [ ] Add production drafter `prepareEvidence`: assert existing context/media
  preconditions, rank observed questions to nine, call Task 1. Drafting validates
  receipt if present; otherwise keeps legacy lexical preflight. Include the receipt
  as a proposal in model context; explicitly require independent FAQ support and
  distinctness in both critic prompts.

```ts
const prepared = options.drafter.prepareEvidence
  ? await options.drafter.prepareEvidence(context) : context;
const drafting = await options.drafter.draft(prepared);
```

- [ ] Worker uses prepared evidence in publicationOrigin and retained artifacts.
  Replay wrapper forwards optional preparation and privately records its input and
  output. Existing pipeline uses it automatically; no manual caller injection.
- [ ] Add explicit optional `{maxRequests: 4|5}` to local model audit; default four,
  real five-stage runner opts into five. Check sixth request never dispatches;
  failures consume slots. Do not alter old run-audit expectations or retry grants.
- [ ] Test preparation failure prevents draft/native QA, prepared FAQ attribution
  reaches artifact, forged/stale receipts fail, and no article can pass solely on
  preparation output. Run covering tests, then full tests/lint/typecheck/build.

### Task 3: Independent review and actual artifact proof

- [ ] Review the whole change against the spec; fix regressions before live work.
- [ ] Select the previously screened, unattempted testimonial-video identity.
  Use the existing normal local runner with a fresh successor grant referencing
  `faq-selection-explainer-proof-2026-09-09`; never modify old state/counters.
- [ ] Run one fresh automatic research/preparation/draft/review/repair/native-QA
  attempt with runtime credentials and publication disabled. Inspect actual Markdown,
  source/FAQ receipt, model audit, native command exits and review flags.
- [ ] If it fails, preserve failure and diagnose that stage; do not claim a fixture
  or rewritten article as the milestone. Keep goal active until actual proof.
- [ ] Commit compact outcome documentation/code on worker PR1; do not commit raw
  bodies, local state, model responses or secrets, and do not touch production.
