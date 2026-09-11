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
