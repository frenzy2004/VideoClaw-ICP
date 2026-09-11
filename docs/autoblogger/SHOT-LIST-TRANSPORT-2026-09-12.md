# Shot-list draft transport investigation

## Whole-worker result: failed

`shot-list-live-proof-2026-09-12` completed automatic research, source-body verification and three-question FAQ preparation. It collected nine organic results and nine observed PAA questions. The first draft request then hit the configured 600,000ms deadline. There was no completed draft, critique, native QA or accepted article in this run.

- Candidate: `video shot list template`, article `vc-c1-d-e1a7b92dd95b91e1`.
- Google run/dataset: `Tc9nlNQhzj6MHbatw` / `7jMUIcZCNBVauxhcQ`.
- PAA run/dataset: `VhDQUgYhpipaqfNWS` / `9P4MFTRAlZdwKXmF4`.
- State retains 35 runs / 57 failures; no successful pilot. The failure was not reset or reopened.

## Single-call transport diagnostic: completed, not article proof

The original wire request was 57,826 characters, slightly smaller than the preceding storyboard request that completed in 84 seconds. Request size does not establish the cause of the timeout. The synchronous request used `store:false` and returned no response ID, so it cannot be recovered by later retrieval.

One saved-input diagnostic changed only `stream:true`. It retained the model, input, schema, reasoning and output limits. Headers and `response.created` arrived in 1.8 seconds, visible output began at 26 seconds, and `response.completed` arrived at 131 seconds. There were 9,658 text delta events. Usage: 11,542 input / 10,708 output tokens, including 1,034 reasoning tokens. No fallback or automatic retry occurred.

This is evidence of a completed streamed generation, not proof that streaming caused the improvement or that the article passes independent review. The exact provider timeout cause remains uncertain. The diagnostic changed no worker state, original receipts, or worker/lander checkout; its integrity receipt confirms state hash `7b34e6c3b75f96174e14ea08fb441d98aee3277187e096569c75378abfa6d981`.

Private receipts: `artifacts/autoblogger/shot-list-stream-diagnostic-2026-09-12/`. Full responses and source bodies remain ignored, not committed.

## Worker transport change

The Responses client now requests SSE with the same strict schema, `gpt-5.5`, `store:false`, finite deadline and no retry. The HTTP boundary reads events incrementally, bounds wire bytes, handles split UTF-8, and returns only the matching terminal response object to the existing output and article validators. It does not accept partial deltas as a draft and does not wait for HTTP EOF after a terminal event. Provider failed/incomplete states remain failures. Background storage is not enabled.

Local progress emits only response ID, event type and output-character count, at first output and bounded intervals. It does not emit text, prompts, credentials or headers. No source, FAQ, review, repair, retry, media or publication gate changed.

Official API references: [streaming events](https://developers.openai.com/api/docs/guides/streaming-responses), [GPT-5.5 streaming support](https://developers.openai.com/api/docs/models/gpt-5.5).

## Verification and boundaries

New tests were observed failing before the implementation. The full suite passes 2,801 tests across 63 files, with lint, typecheck and worker build passing. Existing Vinext dynamic-import warnings remain. Independent bounded review found no P1/P2 findings after 74 focused tests and six loopback probes. The tracked patch passes whitespace and secret-pattern checks; the read-only lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.

The full research → draft → critique/repair → native-QA milestone remains open. No lander source change, lander PR, production deployment, indexing, publication or schedule activation occurred.

## Independent review diagnostic and accounting correction

The saved streamed draft subsequently passed independent critique and, after one bounded repair, independent final verification. All three live requests completed through the worker's streaming transport. The diagnostic still returned blocked: `repair.source_growth` counted eight words from an unchanged heading against Epidemic Sound's original one-word allowance. Initial review classified that same heading as original guidance; final review classified it as source-derived. No extra words were written at that location.

The accounting fix distinguishes reclassification of byte-identical fields from source words added by repair. It requires matching complete current review ledgers, the captured original policy, unchanged whole-field text and bindings, unchanged section/FAQ/graphic framing, and a passing repair-delta check. Such retained words are still fully charged to the final source total and reviewed for support/copying; they are excluded only from the comparison of newly written source words. Captured ceilings are not increased, edited prose gets no credit, and the final 120-word repair target / 180-word hard source cap remain in force. Verdicts and article text are never rewritten by this calculation.

Ten test-first regressions cover unchanged headings, changed prose/evidence/location/framing, stale review/policy, full-source caps and attempted spending of retained credit on rewritten words. Full verification: **2,811 tests across 63 files**, zero failures/skips, lint/typecheck/build passing. Independent bounded review found no P1/P2 findings after 158 focused tests and 75 in-memory probes.

## Exact saved-response native revalidation: passed

`artifacts/autoblogger/shot-list-native-revalidation-2026-09-12/` replays the exact four captured generation/review responses through the corrected code. Every request matches its saved input. No new model request, evidence injection, manual article edit, state reset or candidate retry occurred.

The real publisher validated the resulting bundle against an isolated lander checkout at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`: install, **32 native blog tests**, lint, build and workspace integrity all exited zero. Outputs are private, ignored `review-article.md` (1,519 body words) and `review-graphic.svg` (1200×675). Frontmatter has `status: review`, all four approvals false, no `publishedAt`, `/download` CTA and provider-pending paid metrics.

The native revalidation's integrity receipt confirms unchanged worker/state/original receipts and read-only lander during execution. State remains 35 runs / 57 failures. This is an accepted saved-response review artifact, **not fresh uninterrupted whole-worker proof**. Both earlier failed run receipts remain failed; a new automatic research-through-native-QA run is still required.

## Explicit body-only source review

Two later whole-worker attempts remain failed:

- `production-brief-live-proof-2026-09-12`: nine organic results but no observed PAA questions; rejected before model calls or drafting.
- `preproduction-live-proof-2026-09-12`: a research-only prescreen first found eight organic results, five suggestions and nine observed questions. The fresh worker independently recollected eight organic results and nine questions, retrieved source bodies and completed one source-relevance model call. Of 50 excerpts across 20 documents, one included the passage's heading prefix. The exact-body validator rejected it before FAQ preparation or drafting. Google run/dataset: `QmKNGPVjvhGCtBb5Q` / `KbEJ6PRmKydAr6Fcp`; PAA: `dl4K3qgFPkBsVjNlf` / `0BE3xbybS2SGqE77Z`.

The confirmed input-design problem was presenting a merged heading/body string and asking the reviewer to respect a numeric UTF-16 offset. The request now supplies separate `headingContext` and `bodyText` fields. Code performs the existing exact split; the model selects excerpts only from `bodyText`. Full-document hashing, original source passages, heading boundaries, exact-match validation, reference-correction provenance, source-count/authority gates and request limits remain unchanged. No trimming, fuzzy acceptance, extra model retry or failed-candidate reopening was introduced.

The new boundary test was observed failing before implementation; it covers an astral-character heading and unchanged body text. A second regression explicitly rejects a heading concatenated with otherwise valid body text. Full fresh verification: **2,813 tests / 63 files**, zero failures/skips; lint, typecheck and worker build passed. Existing Vinext dynamic-import warnings remain. Independent read-only patch review found no issues; the reviewer did not run tests under its no-write constraint.

`artifacts/autoblogger/preproduction-source-diagnostic-2026-09-12/` then used the prior automatically discovered URL inventory, fetched the pages anew and ran one new relevance request through the production source checker. It validated all **50 body anchors / 20 reviewed documents** and selected four sources. It did not inject evidence, draft an article or retry the worker. This is source-component evidence, not end-to-end proof. State was unchanged at hash `1e218123cce8c3ef51686340b8be9b909e4c1e9cc5f296a925463b2800e8078f`, retaining **37 runs / 61 failures**, 500 queued candidates and no successful pilot. Raw responses and source bodies remain ignored private artifacts; no lander, production or schedule change occurred.
