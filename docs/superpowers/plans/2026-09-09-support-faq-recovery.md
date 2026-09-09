# Support-search FAQ recovery implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Recover real questions already returned by support searches, retain their provenance and correct bounded cost/taxonomy matching.

**Architecture:** Keep the existing seven-query support search and 24-source-fetch limits. Carry topic-relevant PAA observations into body selection without changing the original keyword SERP, trusting snippets, or creating questions. Match cost and type questions conservatively and deduplicate equivalent cost wording.

**Tech Stack:** TypeScript, Vitest, existing Apify adapter and safe source reader.

**Spec:** `docs/autoblogger/EXPLAINER-LIVE-PROOF-2026-09-09.md`, exact blocker and next engineering decision; user approved fixing discovery/matching.

## Global constraints

- Existing worker branch and PR #1 only. Lander PR #55 and production remain untouched.
- No new paid run, model request, schedule activation, retry reset, or publication.
- Three distinct observed and body-supported FAQ intents remain required.
- Exact support query, US/en desktop first-page scope, run/dataset/time must remain traceable.
- No additional actor runs; seven support queries and 24 source fetches remain bounded.
- Independent critique, bounded repair and native article QA remain mandatory and unchanged.

## Task 1: Bounded FAQ matching (parallel agent)

Files: `lib/autoblogger/faq-evidence.ts`, `lib/autoblogger/faq-evidence.test.ts`.
Interface: existing `faqBodyMatches`; new `faqQuestionKey(question: string): string`.

- [x] Reproduce missing cost/type anchors with real-function tests before code changes:
  ```ts
  expect(faqBodyMatches('How much does it cost to make an explainer video?',
    'Explainer video costs depend on production scope and editing time.')).toBe(true);
  expect(faqQuestionKey('How much does it cost to create an explainer video?'))
    .toBe(faqQuestionKey('How much does it cost to make an explainer video?'));
  ```
- [x] Implement only bounded grammatical normalization and direct body assertions; retain negative/qualifier/heading checks. Add explicit negative and distinct-cost-subject tests.
- [x] Run `npm test -- lib/autoblogger/faq-evidence.test.ts`; require green.

## Task 2: Preserve supplementary question observations (main agent)

Files: `lib/autoblogger/research.ts`, `support-faq.test.ts`, `worker.ts`,
`worker.test.ts`, `local-pilot.ts`.
Interface: optional `ResearchResult.paaObservations: PaaObservation[]`.

- [x] Test a support-query response whose real PAA adds definition/cost questions:
  ```ts
  expect(result.evidence.faqQuestions).toContain('What is an explainer video?');
  expect(result.provenance.serp.runId).toBe('original');
  expect(result.paaObservations?.find(x => x.question === 'What is an explainer video?'))
    .toMatchObject({query: 'How can I create an explainer video?', runId: 'support'});
  ```
- [x] Admit questions only from exactly requested support rows with valid locale/device/page. Apply topic filtering and question-key deduplication; cap observations at 30 and source-selection pool at nine. Never copy provider answers.
- [x] Pass the expanded pool to safe body selection; preserve original SERP identity/count and select only three supported questions. Carry deep observations into private artifacts/audit instead of discarding them at the worker boundary.
- [x] Test wrong query/locale/device/page, duplicates, unrelated and secret-like questions, observation caps and no extra paid call; verify artifact provenance through the real worker.
- [x] Address independent review: preserve search punctuation, reported spelling and raw ordinals; never infer expansion ancestry; constrain complete cost predicates and attribution qualifications. Keep existing valid source-selection cases passing without editing their expectations.

## Task 3: Verify and checkpoint

- [x] Replay saved support responses through the corrected researcher with real safe body reads, intercepted model boundary and unchanged state. This is a diagnostic, not a new successful pilot.
- [x] Run full tests, lint, typecheck, build and whitespace checks; independently review the scoped diff.
- [x] Update current report/docs with measured outcome and outstanding dependencies; scan changed files for secrets and broken links.
- [x] Commit and push only the worker feature branch; update PR #1. Return both current PR links and team requirements.
