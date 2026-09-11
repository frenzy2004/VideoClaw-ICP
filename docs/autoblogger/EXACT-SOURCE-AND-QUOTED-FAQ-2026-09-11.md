# Exact first-party sources and quoted FAQ observations

## Scope and outcome

Worker branch only. No lander changes, generated lander PR, publishing, merging, deployment or schedule activation. The complete fresh article-to-native-QA milestone remains open.

A twelve-topic US/en screen narrowed the next engineering candidate to the unchanged backlog record `vc-c4-041`, **Content Repurposing Queue Management: States, Limits, and Blockers**. Its original matrix distinguishes concurrent work intake, capacity and blockers from a single-asset production workflow. Independent editorial assessment confirmed that distinction but warned that the observed questions are broader repurposing questions, not direct evidence of demand for WIP management. Neither organic results nor PAA establish search volume.

The screen and subsequent qualification checks left persistent state unchanged: 30 runs, 51 failure records, no active pilot; SHA-256 `a2fa39b412e28aacd5d241ba910cf187c3534f58d1b056e7590ddc63d3f45910`. No exhausted candidate was reset or renamed.

## Two corrections

**First-party source scope.** The body reviewer admitted six relevant pages, but the existing authority list recognized none. [Sendible's own Smart Queues page](https://www.sendible.com/features/smart-queues) documents its scheduling, pause and editing controls. An `exactPath` authority rule now recognizes only that page on the canonical hostname/default HTTPS port. Other paths, lookalike hosts and out-of-scope redirects do not inherit authority. Exact and prefix rules cannot be combined. Existing prefix rules and publisher discovery queries are unchanged.

This is primary evidence of the vendor's own documented controls, not independent proof of advertised results, a comparative endorsement, a VideoClaw capability, or automatic approval of any claim. Body retrieval, contextual relevance, FAQ support, independent critique and source-use limits still apply.

**Quoted question transport.** The live Responses endpoint rejected a literal quotation mark in a FAQ question enum with HTTP 400 `invalid_json_schema`. Question text now stays in the model input; its structured response field is a length-bounded string. Before any prepared context is returned, code still requires byte-for-byte membership in the original observed pool, three distinct intents, exact body anchors and the unchanged context hash. Removing the quotation marks or inventing a question remains rejected. This retains strict structured output, with semantic and observation checks in application code. [Official structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs).

## Live evidence and limits

- Twelve-topic screen: SERP run/dataset `iWhDQftWI57xszSTE` / `U6W0tnRUxTGYluRb6`; autocomplete `89ZYn3GAmSH6M5YU0` / `cUyNhGTCjnTUgxgzR`; PAA `va9btdOdbfZZw8KBl` / `Y5REaqv50shUBwNKe` and `dwyhjMh0OYZaZSMo7` / `5jLpIiZc8lak4Ngia`.
- First qualification hit the ten-minute model timeout. The next, explicitly medium-reasoning diagnostic completed source review but failed the missing-authority gate. Its support run/dataset was `UJRK0OxRm7EOTKk3b` / `PfOnDLE8QgUDYZ70T`; model usage was 29,637 tokens. These were read-only qualification checks, not worker attempts.
- The post-fix fresh support actor `uyzs7v4fcnpcVinQ1` timed out before a model call. Its failure is retained.
- A separately labelled component check reused the earlier successful support search after checking its run status and exact query input, then fetched source bodies again. It qualified Sendible, Podsqueeze, Postiv and ProdShort, and subsequently exposed the quoted-question schema rejection. No facts were manually supplied.
- A one-call FAQ diagnostic rebuilt the identical captured research context and changed only the provider schema. It passed with three observed questions: effective repurposing tools, repurposing benefits, and adapting content across platforms. Exact body-anchor and observation checks passed. These remain provisional until the article's independent editorial review; no article or native QA result was produced by this diagnostic.

Private receipts remain ignored under `artifacts/autoblogger/question-fit-screen-2026-09-11`, `queue-evidence-qualification-2026-09-11*` and `quoted-faq-component-2026-09-11`. They are not fresh uninterrupted worker proof.

## Verification

The initial authority regressions produced eight expected failures before implementation. Independent review identified non-default-port inheritance; two direct/redirect tests reproduced it before correction, and focused rereview closed it. The quoted-question regression reproduced the live schema failure before its fix; a separate test still rejects quote removal.

Full suite: **2,703 tests across 60 files**, zero failures/pending, plus lint, typecheck and build. Existing dependency bundling warnings remain. Receipt: `artifacts/autoblogger/quoted-faq-suite-2026-09-11.json`.

Independent FAQ-patch review found no actionable P1/P2 issue; all 82 focused FAQ tests passed. This review does not approve any article or establish whole-worker success.

## Workflow applied

Systematic debugging separated source classification, provider timeout and schema failures. Brainstorming bounded the changes to existing interfaces; test-driven development reproduced the defects first. Independent review caught the origin-boundary issue. Official OpenAI documentation informed the structured-response boundary. Verification-before-completion keeps these component results separate from the outstanding whole-worker milestone.
