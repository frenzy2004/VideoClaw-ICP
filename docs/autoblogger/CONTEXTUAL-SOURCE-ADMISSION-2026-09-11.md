# Contextual source admission

## Design

The single-sentence keyword screen rejects relevant pages whose bodies explain a topic across paragraphs. Keep that screen as a deterministic ranking signal, not as a semantic verdict when a structured reviewer is configured.

One bounded source-admission request evaluates the already retrieved, exact passage inventory (at most 24 pages, 8,000 characters each, URLs capped at 2,048 characters and aggregate input capped at 256,000 UTF-8 bytes). It receives the exact query, article title and observed questions. Every page gets an explicit relevant/irrelevant decision. A relevant decision must contain exact body-only anchors with passage indices and a reason explaining the reader-task connection. Headings may establish context but cannot serve as the evidence anchor. Responses bind to a SHA-256 snapshot, including the URL, retrieval hash and passage text. Unknown, duplicate, missing, stale, malformed, secret-bearing or changed inputs fail closed.

Admission is only permission to consider a source. It is not claim verification, editorial approval, permission to copy, an independent product endorsement or demand validation. The existing two-source/one-authority minimum, four-page selection limit, claim review, source-use accounting and publication gates remain intact. Research without a model retains the conservative lexical path; configured reviewer failures never fall back to it.

## Implementation plan

- [x] Add `source-admission.ts` and tests for context-bound decisions, exact body anchors, negative decisions, malicious outputs and bounded inputs.
- [x] Refactor `sources.ts` to retrieve first, request one admission receipt, then rank only admitted pages. Return receipt to private research diagnostics; do not put page contents in persistent state.
- [x] Wire the shared audited model client into production article research and local pilots. Bound a local pilot to six calls: source admission, FAQ preparation, generation, critique, one repair and fresh verification.
- [x] Exercise the exact failed source set as a component diagnostic without changing terminal candidate state or calling it fresh worker proof.
- [x] Run regression tests, lint, typecheck and build; independently review worker-only changes.

No new candidate identity, retry reset, production write, generated lander PR, publishing or schedule activation is part of this correction.

## Live component evidence

At `2026-09-10T18:52Z`, the production safe reader fetched the four TechSmith/Descript URLs retained by the previous buyer-intent diagnostic. No source facts were supplied to the pipeline: all bodies were retrieved again. One `gpt-5.5` Responses request admitted all four with exact body anchors explaining their connection to automated editing and buyer evaluation. This demonstrates the contextual retrieval correction, not endorsement of the pages' marketing claims.

The request used 6,955 input and 1,833 output tokens (8,788 total). It ran no Apify actor, generated no article and attempted no native QA or publication. Receipt files remain private and ignored under `artifacts/autoblogger/contextual-source-component-2026-09-11/replay/`. A subsequent zero-call revalidation verified the code-derived document-ID/URL/retrieval-hash mapping against the same unchanged input and response.

Persistent state was identical before and after: SHA-256 `0be8119b09d2b1f522dffe48fc4de00ddf29e59f1574e7225b1b6a1746ad61b6`, 28 runs / 48 failure records, no active pilot. The old buyer candidate remains failed. A new uninterrupted whole-worker article proof is still outstanding.

## Verification

Final suite: **2,677 tests across 60 files**, zero failed or pending, plus passing lint, typecheck and worker build. Existing dependency bundling warnings remain. JSON test evidence is ignored at `artifacts/autoblogger/contextual-source-suite-final-2026-09-11.json`.

Independent review found an unbounded URL/request-size path. Three regression cases reproduced it before the URL and UTF-8 aggregate caps were added; all 32 admission tests then passed. Focused rereview confirmed that issue closed, with no other finding in its scope. Runtime integration tests verify a shared audit sequence, all reviewed-page mappings despite selecting four, absent-receipt compatibility, failed-review propagation and the explicit six-call limit. The previous four/five-call limits remain supported for older diagnostic callers.

## Fresh backlog attempt and exact reference correction

`repurposing-workflow-live-proof-2026-09-11` used the unchanged, previously unattempted backlog record `vc-c4-001`, targeting `video repurposing workflow`. It collected eight organic results and ten questions, retrieved sixteen page bodies, and made one source-admission model call. The semantic review rejected four irrelevant pages, but one retained exact quote referenced paragraph 5 instead of paragraph 4 on the same Descript webinar-repurposing page. The strict gate rejected the mismatch before drafting. This attempt remains failed; it generated no article or native QA result.

Exact SERP run/dataset: `crT4dXyeKdnnt8cXS` / `a9wcvYLhvWkPScTi5`. Autocomplete: `J5wOx5DyJhJiPd2ze` / `AsugfrqauFmmznpG5`. PAA: `6cYhh9IrrXeKA3INR` / `hCBqjInM5d9dhpUxC`, following `gfzBNcR4xVcOrROvG` / `PLrPUFuZuqeSbkM4j`. The completed model request used 20,844 input and 9,852 output tokens. The record was executed against the tested, staged implementation; the preflight retains its HEAD-plus-diff implementation hash, rather than claiming a committed revision that did not yet exist.

The corrective code now exposes explicit `passageIndex` fields to the model. A wrong but existing index can be resolved only when the **unchanged exact quote** occurs in exactly one body passage on the **same document**. The original index is retained as `reportedPassageIndex` and revalidated. Unknown indices, invented text, heading-only matches, cross-page matches, ambiguity, duplicate canonical anchors and model-invented correction metadata remain rejected. No quote, relevance decision or article prose is rewritten, and no new model call is added. The failed quote's SHA-256 is `19107f75e430a4b408d1a15c3071c86ab75037a1929230fa687a80a8f580f60b`; a read-only inventory check finds precisely one body match at index 4.

Latest state: **29 runs / 50 failure records**, no active pilot, SHA-256 `2760807b10bbdbf71929fd73a327ed6afe1f4639b384478579d714733d5d6739`. Full fresh article-to-native-QA proof remains outstanding. No failed candidate is reset or renamed to retry it.

After the reference correction, **2,681 tests across 60 files pass**, zero failed/pending, plus lint, typecheck and build. Independent follow-up review found no P1/P2 issue in the correction. Evidence: `artifacts/autoblogger/contextual-source-reference-suite-2026-09-11.json`; 36 focused admission tests cover the new behavior. The staged diff was checked against both runtime credentials; neither is present. The generic secret-pattern screen matched environment-variable references and synthetic test fixtures, not exposed credentials.
