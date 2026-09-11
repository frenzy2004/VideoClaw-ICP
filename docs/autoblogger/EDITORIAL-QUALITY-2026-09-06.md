# Editorial quality correction — 2026-09-06

Scope: worker PR #1 only. Fix three observed software-quality gaps without
rewriting the live article, granting another retry, or touching the lander.
No new model or research call was made.

## Changes

| Observed problem | Correction |
| --- | --- |
| Description exactly repeats the title | Reject normalized duplicates and descriptions outside the worker's 80–200-character house range. Generation/repair instructions aim for a specific, useful 120–160-character summary without unsupported promises. This is not a Google rule or quality score. |
| Repeated “Original recommendation” and “Original editorial note” prefixes | Detect repeated process labels across public paragraphs, headings, description, graphics and FAQ answers; give the existing repair exact locations/spans. Instructions establish recommendation context once per scoped section, retain source attribution and mark hypothetical examples visibly. Private audience/gap metadata does not count as public repetition. |
| Product-launch checklist question selected for product-demo intent | Article-format words cannot replace the topic. Prefer stronger observed matches, keep exact question wording and stable ties, and still require three qualifying questions. No FAQ is invented or rewritten to pass. |

Independent critique remains mandatory. A positive model verdict cannot bypass
deterministic editorial findings. If the one repair leaves them unresolved, no
bundle is returned. There is no second repair or post-review string stripping.
Exact bindings and product-claim restrictions are unchanged.

FAQ matching is lexical and deliberately conservative. Passing it is not a
semantic-relevance guarantee, and synonymous wording can still be rejected.
A follow-up regression caught valid founder-pitch FAQs rejected merely for
omitting “workflow.” Trailing workflow/process/plan forms are now optional when
two topic terms remain; interior topic terms are still required. Exact observed
wording and the three-question minimum are unchanged.
Independent review also caught the same false-negative risk from the leading
“how to make” framing of the existing founder-pitch campaign keyword. Only
leading “how to make/create” is now excluded from topic matching; the original
query is still sent unchanged and substantive verbs elsewhere remain required.

## Saved live evidence audit

An offline, read-only audit loaded the original saved context and repaired
response from `automated-product-demo-attribution-pilot-2026-09-06`, verifying
their receipt hashes before inspection.

The unchanged response now produces:

- `content.description_length`: one finding.
- `content.description_duplicate`: one finding.
- `content.editorial_scaffolding`: 22 findings.

Re-selection from the **same observed question pool** gives:

1. What is a product demo?
2. When starting a product demo, what should you do first?
3. Can you give me an example of a product demo?

The product-launch checklist question is excluded. This is a re-selection audit,
not a new search observation and not a regenerated FAQ answer. Original organic
and dedicated-PAA provenance remains in the retained research bundle.

Audit fingerprints:

- Saved repair response text SHA-256: `ae7c56eeedfaf4265ddb431adb06214a92ea9f07f4647aa6a198e7459dcc3e6c`.
- Original exported Markdown SHA-256: `6218cac4a9b9b7d2814c0f1472db884424e9f5e917776e2901e437591ec538d2`.
- Local state SHA-256 before and after: `f98bfe604f68bab064bc455234b9e63c4da2cff955bee4ba6eeed9852ad0e177`.

The diagnostic script is local and ignored:
`artifacts/autoblogger/editorial-quality-20260906/audit.ts`.
It writes no state and makes no API calls. Raw page/model contents are not in Git.

## What this proves—and does not

Independent review found that soft-wrapping a label could hide it from
sentence-based detection even when it remained visible to the reader. Four RED
regressions, including the real drafting/repair orchestration with mocked model
outputs, reproduced that false acceptance. The fix checks rendered Markdown
blocks across soft and hard line breaks, keeps exact block text for repair, and
does not strip or change audited prose.
Both review findings were reproduced before their fixes, including the actual
single-repair path for the soft-wrap defect and collector/inspection integration
for query framing.

Regression fixtures prove the bad metadata/copy is caught, reaches the single
repair and cannot escape after an unchanged repair, even if both model reviews
approve. FAQ tests cover the observed mismatch, exact text, stronger-match
selection, duplicate questions, source provenance and bounded collector recovery.

This does not prove that a new live model response will produce polished copy.
The previously saved article was not rewritten and now fails current editorial
checks. Its earlier native QA pass is retained as historical evidence, not current
publication approval. No new browser/Lighthouse or live generated-article QA pass
is claimed.

The candidate remains terminal at attempt three. Original failed runs, retry
history, approvals and artifacts are unchanged. PR #55 remains open/unmerged,
the lander checkout is clean, and `AUTOBLOG_SCHEDULE_ENABLED=false`.
No article PR, publication, deployment, indexing or production change occurred.

## Final software verification

- `npm test -- --maxWorkers=2`: **1,076 tests across 49 files passed**.
- `npm run lint`: passed without new lint warnings.
- `npm run typecheck`: passed, including fresh Next route type generation.
- `npm run build`: passed; existing gray-matter/vinext dependency warnings remain.
- `git diff --check`: passed.

The full suite includes the offline 50-candidate research/drafting/repair flow,
native article parsing and fixture rendering, per-ICP caps and restart behavior.
It does not turn mocked model outputs or a fixture renderer into live generation
or a full native Next application build. Local state and original article hashes
remain unchanged after the final saved-evidence audit.

Independent final scoped re-review found no remaining P1/P2 in the six changed
code/test files after both reported P2s were fixed. The reviewer verified
272 drafting/bundle tests and 66 research tests plus independent repair-path
reproductions. This is code review, not publication approval for the old article.
