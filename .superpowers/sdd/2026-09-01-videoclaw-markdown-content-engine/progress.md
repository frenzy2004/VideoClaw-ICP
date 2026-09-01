# SDD ledger — plan: docs/superpowers/plans/2026-09-01-videoclaw-markdown-content-engine.md

## Preflight interface scan

| Producer / consumer | Shared file or interface | Finding |
| --- | --- | --- |
| Task 1 → Task 2 | `ArticleRecord`, schema enums | Consistent: Task 2 consumes the typed record and does not redefine it. |
| Task 1 → Task 3 | article loader and publication subset | Consistent: renderer receives complete records and awaits Next 16 params. |
| Tasks 1–2 → Task 4 | loader plus `auditArticle` | Consistent: content map derives totals and findings rather than hard-coding them. |
| Tasks 1–2 → Task 5 | schema, loader, auditor | Consistent: all five content slices use one fixed contract and one integrated acceptance test. |
| Task 1 → Task 6 | `getPublishableArticles` | Consistent: discovery remains fail-closed and excludes operational routes. |
| Tasks 3–4 | `app/globals.css` | Shared append-only integration point; keep selectors namespaced to avoid conflicting edits. |
| Tasks 1–6 → Task 7 | full build and routes | Consistent: deployment follows local tests, typecheck, lint, both builds, and browser checks. |
| Task 1 internal | tests vs parser/loader | Consistent: each required behavior has a literal failing fixture before implementation. |
| Task 2 internal | tests vs QA/provider contracts | Consistent: scores and provider validation are deterministic and observable. |
| Task 3 internal | page tests vs renderer | Consistent: tests cover metadata, safe Markdown, attribution, media, and gating. |
| Task 4 internal | table tests vs operational screen | Consistent: fixture-based totals and visible workflow labels cover the contract. |
| Task 5 internal | filesystem test vs five libraries | Consistent: one acceptance test proves exact counts, uniqueness, body, evidence, and media. |
| Task 6 internal | discovery tests vs implementation | Consistent: synthetic publication fixture proves both closed and open gates. |
| Task 7 internal | acceptance commands vs release | Consistent: local and deployed evidence are required before the stable alias changes. |

Ruling: Work in the current clean `codex/demo-day-seo-campaign` checkout — the user explicitly instructed execution without further questions, the branch is not `main`, and a nested worktree would add coordination risk; if wrong, changes remain isolated to this dedicated branch but not a linked worktree.

Ruling: Task 5's five campaign directories are independent same-contract slices and may be researched/authored in parallel, followed by one integrated library test and review — this reduces wall-clock time; if wrong, integration may reveal cross-campaign slug or keyword collisions that require a cleanup pass.

Ruling: Updating the existing `videoclaw-demo-day-review` Vercel deployment is authorized by the user's explicit deployment instruction — production indexing remains disabled; if wrong, the review alias changes but can be rolled back to the prior deployment.

Ruling: The clarified public route contract is `/blog/<slug>` rather than `/articles/<slug>` — the user's concrete URL example and repeated description of blog articles resolve the earlier ambiguity; if wrong, renderer paths require a mechanical route/canonical rename before publication.

Ruling: Live Apify SERP/autocomplete provenance is required before an opportunity joins the final 250, while only proprietary volume/KD/CPC remain pending — this follows the user's explicit correction; if wrong, the extra research data increases storage and processing but does not change indexability.

Task 1: implementation commit e665e12 reported focused 15/15, typecheck clean, full suite 88/88; task review dispatched against 975ef83..e665e12. Post-task spec amendment requires a follow-up schema/test change for `/blog` canonicals and `serp_evidence`.

Task 1: review found 1 Critical and 4 Important issues — exact library counts not enforced; keyword/draft state coupling absent; campaign directory not validated; media path/rights guarantees incomplete; raw HTML event-handler bypass. Minor duplicate normalization and negative-test gaps were included in fix round 1. Fix round 1 also carries the `/blog` and Apify provenance amendments.

Apify discovery: five US/en autocomplete runs succeeded — newly funded `hRC9s6kTfHfameyaj` / dataset `BUOnbhfsjR1OGcIe1`; Demo Day `ZM1zqFuWn5T5yvkB8` / `PfQcS6wc88WPoiIgV`; comparison `OYqFIQA3vWcDXcaI6` / `FhLs6apRBehAegjzh`; GTM `s2xicDcrW1ZdwwFc9` / `oDmIoNEp1bQr1rvBX`; portfolio `DtBQkoE1h2xtTICSO` / `HdkxIVxqZVri1wWzx`.

Apify SERP: GTM matrix contributed 200 unique primary/secondary candidate queries to official Actor `apify/google-search-scraper`; run `1Amv8DcIBqr0ag11b`, dataset `7VqxRTSF4IokgTcKq`, US/en desktop, first page, paid/lead/AI/content add-ons disabled.

GTM matrix fix round 1: applied the independent review by separating workflow handoffs from lifecycle guidance and queue states from role/decision-right design; relabeled six commercial-investigation intents; narrowed or marked seven unsupported competitor gaps as pending observed Apify evidence; strengthened GTM-specific webinar, podcast, and product-demo queries; renamed evidence headings and normalized locale parameters. Mechanical verification: 10 clusters, 50 sequential IDs, 50 primary + 150 secondary = 200 case-insensitive-unique candidates, 50 unique titles, 50 unique slugs, 7 explicit Apify-pending gaps, and no malformed reviewed locale parameters.

Accelerator/Demo Day matrix fix round 1: applied independent review while preserving the candidate pool. All ten gap columns are explicitly hypotheses pending observed US Apify SERP evidence; the reviewed unsupported category claims were narrowed accordingly. `vc-c2-001` is now an evergreen lifecycle-planning checklist and `vc-c2-017` a final 72-hour blocker test; `vc-c2-041`, `042`, and `045` now serve explanation, audit, and download jobs; the duplicated repurposing query was replaced; and `004`, `005`, and `050` use informational intent. Timeline specs now cite named first-party examples in Austin/Texas, Chicago, Boulder, Columbus, Los Angeles/Southern California, Cambridge/Boston, New York, and New Orleans without inventing shared cohort or Demo Day claims. Mechanical verification: 10 clusters, 50 sequential IDs, 50 primary + 150 secondary = 200 case-insensitive-unique candidates, 50 unique primary keywords, 50 unique titles, 50 unique slugs, and zero duplicate candidates; all keyword metrics remain pending.

Video production comparison matrix fix round 1: applied independent review while preserving the candidate pool. All 50 unsupported competitor/content gaps are explicitly hypotheses pending observed US Apify evidence; the six reviewed cannibalization pairs now represent distinct search jobs; startup/founder decision framing was strengthened across operational clusters; all 13 misclassified transactional intents were relabeled informational or commercial; nonexistent comparison-route CTAs were replaced with publication-safe article copy; and evidence headings were corrected. Mechanical verification: 10 clusters, 50 sequential IDs, 50 primary + 150 secondary = 200 case-insensitive-unique candidates, 50 unique primary keywords, 50 unique titles, 50 unique slugs, 50 Apify-pending gap labels, zero remaining invalid comparison CTAs, and clean Markdown whitespace; all proprietary keyword metrics remain pending.

Newly funded founder matrix fix round 1: applied independent review while preserving the candidate pool. The reviewed cannibalization pairs `006/007`, `021/022`, `026/027`, and `046/050` now serve distinct outline, worksheet, strategy, definition-page, proof-hierarchy, claim-preflight, pillar-guide, and explicit-download jobs; broad category, launch, thought-leadership, customer-proof, and earned-to-owned queries now reconnect to the newly funded US founder trigger; reviewed unsupported gaps are labeled as hypotheses pending observed Apify evidence; `009`, `019`, `024`, `034`, and `039` are informational, while `050` remains transactional through explicit download intent; `020` states its federal-only baseline and state/local variation; source fields and CTA asset status were clarified. Mechanical verification: 10 clusters, 50 sequential IDs, 50 primary + 150 secondary = 200 case-insensitive-unique candidates, 50 unique primary keywords, 50 unique titles, 50 unique slugs, 50 renamed source/evidence fields, 9 explicit Apify-pending gaps, zero legacy source headings, and clean Markdown whitespace; all proprietary keyword metrics remain pending.
