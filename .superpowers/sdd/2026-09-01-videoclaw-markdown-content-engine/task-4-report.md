# Task 4 report — SEO content map and workflow diagram

## Status

Implemented the private `/seo/content-map` operational route within the Task 4 file boundary.

## Delivered

- Static route metadata that always emits `noindex, nofollow`, including Googlebot directives.
- Server-owned loading through `getAllArticles()` and local media existence checks against `public/`.
- A real client inventory component that audits every supplied record with `auditArticle()` and evaluates the article-level publication gate with `isArticlePublishable()`.
- Record-derived totals for the whole library, every campaign, publication readiness, pending keyword validation, and blocking findings.
- A table that renders every supplied record and includes campaign, funnel, intent, status, indexing, keyword state, all five deterministic QA scores, every blocking finding, rendered-page links, GitHub Markdown-source links, and literal source paths.
- Interactive native campaign, funnel-stage, and status filters.
- A semantic ordered workflow: Research signals → Keyword validation → Markdown source → Editorial QA → Rendered page → Sitemap gate.
- Namespaced responsive styles, keyboard-scrollable table overflow, and compact mobile layouts.

## TDD evidence

RED:

```text
pnpm test app/seo/content-map/page.test.tsx
FAIL — Failed to resolve import "./content-map" because the Task 4 route did not exist.
```

GREEN contract:

- Complete five-record fixture spanning all five campaigns.
- Totals proved from five records rather than the 250-record target.
- Five inventory rows plus the header.
- Five pending-provider badges.
- Real deterministic technical, attribution, evidence, media, and keyword scores.
- Exact blocker messages from the real auditor.
- Rendered and source destinations.
- Campaign, funnel, and status filter behavior.
- All six workflow labels.
- Always-noindex route metadata.

## Verification

```text
pnpm test app/seo/content-map/page.test.tsx
4/4 passed

pnpm run typecheck
passed

pnpm run lint
passed

git diff --check -- app/seo/content-map app/globals.css
passed
```

The final test, typecheck, and lint pass was repeated from an isolated `git checkout-index` snapshot of the exact staged patch. This prevented concurrent, out-of-scope edits in the shared working tree from entering or invalidating the Task 4 verification result.

## Self-review

- Totals and table rows are derived only from `records`; no production total is hard-coded.
- QA results use the shared auditor; the screen does not recreate scoring rules.
- Asset existence is calculated on the server and crosses the client boundary as serializable paths.
- The table maps the complete collection, so the same component supports five fixtures or the planned 250 records.
- All new CSS is scoped under `.content-map-*` selectors.
- No `lib/content`, `lib/seo`, `lib/keywords`, scripts, data, matrices, or `app/blog` files were changed by Task 4.

## Remaining integration dependency

The route intentionally consumes the canonical filesystem library. End-to-end route/build verification therefore remains dependent on the later task supplying the complete validated Markdown library and owned media assets.
