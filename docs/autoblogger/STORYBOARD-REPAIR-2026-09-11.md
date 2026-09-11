# Storyboard run: repair diagnosis

The fresh worker run `storyboard-live-proof-2026-09-11` failed. It is not an accepted article or a successful pilot.

## Observed result

- Candidate: `video storyboard template`, `vc-c1-d-55452434713fe98e`.
- Automatic US/en research returned eight organic results and ten observed questions.
- Source inspection and three body-supported FAQ answers passed. Sources included Boords, TechSmith, StudioBinder, and Adobe.
- Draft generation, independent critique, and the single repair request each returned completed model responses.
- Repair was rejected for five per-fact evidence-growth violations. Native lander QA did not run; no article, branch, or lander PR was accepted.
- Google SERP run/dataset: `iU7SDasYubxBFV7fU` / `AVq7ReKAhNLpv2G2d`. Raw data remains in Apify/private ignored artifacts.
- The recorded failure remains terminal. State has 34 runs and 56 failure records, with no consumed successful pilot. No retry reset or history rewrite was made.

## Root causes

The reference-review guard treated `the product` as a software noun even inside ordinary phrases such as `the product lead`, `the product flow`, and `the product demo storyboard`. The independent reviewer had correctly classified eight affected spans as non-VideoClaw, but the code vetoed those classifications. This created unnecessary repair work.

Separately, numbered/bulleted Markdown and plain text containing a ratio fell back to whole-field repair. The model could therefore redistribute existing evidence across rewritten sentences within those fields; five resulting per-fact totals exceeded their original limits. The accounting rejection itself was valid and is retained.

## Boundaries

The correction preserves current independent reference review, exact visible anchors and review hashes, explicit VideoClaw restrictions, source support and copying checks, and all repair ceilings. An ordinary noun compound is not automatically an approved claim. Unknown compound continuations and software noun heads remain unresolved.

Saved-draft diagnostics are component checks only: they cannot establish fresh search discovery, consume a successful pilot, reopen an exhausted candidate, or replace the uninterrupted worker milestone. No production, lander source, deployment, scheduling, approval, publishing, or indexing changes are authorized here.

## Implemented corrections

- Ordinary product compounds still enter the conservative reference-review manifest. They can be resolved only by a current independent `non_product` classification with an exact visible anchor and unchanged review hashes. Explicit brands, unresolved compound continuations, and singular/plural software nouns retain the veto.
- Plain Markdown paragraphs and lists now map exact, unique binding spans to literal text leaves. Code owns each sentence's evidence IDs, product reference and word ceiling. Numeric ratios, hyphens and fill-in blanks in original text no longer force an entire section into field repair.
- Null edits preserve bytes; explicit sentence deletion can remove an emptied paragraph. Repair cannot introduce a new Markdown structure or leave an empty list item. Links, tables, task lists, code and inline formatting retain the prior field contract.
- The original source and per-fact accounting checks remain active. All five captured over-growth violations remain rejected.

The saved-input mechanical check maps the four captured section bodies to 11, 9, 9 and 13 sentence bindings, preserves a null patch byte-for-byte, and removes the eight false reference findings using the existing independent classifications. It uses no new research/model calls and changes no state.

Test-first regressions cover the observed failures and review-found edge cases. Independent bounded review found no remaining P1/P2 issues after the corrections. That review does not constitute article approval or fresh end-to-end proof.

## Verification

- Final reviewed tree: 2,788 tests across 62 files, zero failures/skips (`npm test -- --maxWorkers=4`).
- Lint, typecheck and worker build pass. Existing Vinext ineffective-dynamic-import warnings remain.
- The first unrestricted run overlapped a build and failed the existing 250-row content-map test with `STACK_TRACE_ERROR`. That test passed independently; the bounded-concurrency full suites passed without changing that test or its timeout. All receipts are retained.
- Private test receipt: `artifacts/autoblogger/storyboard-repair-reviewed-suite-2026-09-11.json`.
- Tracked patch secret-pattern scan and `git diff --check` pass.
- The read-only lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
- The saved-draft paid diagnostic is separate from these checks and from the failed fresh worker run. No successful native article QA is claimed by this checkpoint.
