# VideoClaw 250-Article Markdown Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a private-review Markdown publishing system containing exactly 250 traceable US-focused VideoClaw articles, with deterministic SEO/evidence/media QA and gated public discovery.

**Architecture:** Source-controlled Markdown and YAML frontmatter are canonical. A server-only loader validates the full library, a dynamic App Router route renders static article pages, a deterministic auditor powers an operational content-map screen, and sitemap/robots include only records that pass both article-level and global publication gates. Five disjoint campaign libraries are authored in parallel against one fixed schema.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, gray-matter, Zod, react-markdown, remark-gfm, Vitest, ESLint, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-01-videoclaw-markdown-content-engine-design.md`

## Global Constraints

- The library contains exactly 250 `.md` article sources and exactly 50 sources for each fixed campaign ID.
- Markdown at `content/articles/<campaign-id>/<slug>.md` is the canonical source; article body copy is not hard-coded in JSX.
- Numeric volume, difficulty, CPC, click, and traffic values are `null` until imported from an authenticated provider.
- Live US Google SERP and autocomplete evidence is collected through Apify before final article selection; every final article records its Actor, run, dataset, query, timestamp, competitors, and observed query features.
- Every generated draft is `status: draft`, `indexing: noindex`, and `keyword_evidence.validation_status: pending_paid_provider` in this review release.
- Every article has unique `article_id`, `slug`, `title`, and `primary_keyword` values.
- All external factual claims use source links; unsupported product, pricing, integration, timing, outcome, privacy, or customer claims are forbidden.
- Every media entry has source, alt, caption, credit, and rights fields; only local owned assets are used in the review release.
- `/seo/content-map` and every review article are noindex; public indexing additionally requires `NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING=true`.
- Work remains on `codex/demo-day-seo-campaign` and deploys only to the existing `videoclaw-demo-day-review` Vercel project.

---

### Task 1: Article schema, parser, and full-library validation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/content/article-schema.ts`
- Create: `lib/content/articles.ts`
- Create: `lib/content/articles.test.ts`
- Create: `content/articles/.gitkeep`

**Interfaces:**
- Produces: `ArticleFrontmatter`, `ArticleRecord`, `LibraryFinding`, `LibraryValidationResult`, `parseArticleSource(source, filePath)`, `getAllArticles()`, `getArticleBySlug(slug)`, `getPublishableArticles()`, and `validateArticleLibrary(records)`.
- `LibraryValidationResult` is `{ valid: boolean; findings: LibraryFinding[]; totals: { all: number; byCampaign: Record<CampaignId, number> } }`.

- [ ] **Step 1: Install parser dependencies**

Run:

```bash
pnpm add gray-matter zod react-markdown remark-gfm
```

- [ ] **Step 2: Write the failing parser and library tests**

Create `lib/content/articles.test.ts` with literal fixtures. Tests must prove that parsing returns typed frontmatter and body, missing fields fail with file-specific findings, path/frontmatter slug mismatches fail, non-local media fails, duplicate article IDs/slugs/titles/primary keywords fail, review drafts remain non-publishable, and a synthetic 250-record library reports 50 records for every campaign.

The minimum valid fixture uses these exact values:

```ts
const validSource = `---
schema_version: 1
article_id: vc-c1-001
campaign_id: newly-funded-founder
icp: Newly funded US startup founder
customer_trigger: Closed a funding round
funnel_stage: top
search_intent: informational
primary_keyword: startup funding announcement video
secondary_keywords:
  - funding announcement content
title: Startup Funding Announcement Video Guide
description: Build a credible funding announcement video and reuse its approved evidence across investor, customer, and recruiting follow-up.
slug: startup-funding-announcement-video
status: draft
indexing: noindex
canonical_path: /blog/startup-funding-announcement-video
competitor_gap: Existing pages focus on press releases rather than reusable approved video evidence.
keyword_evidence:
  provider: pending
  country: US
  observed_at: null
  volume: null
  difficulty: null
  cpc: null
  intent: informational
  validation_status: pending_paid_provider
serp_evidence:
  provider: apify
  actor: apify/google-search-scraper
  query: startup funding announcement video
  country: US
  language: en
  observed_at: 2026-09-01
  run_id: test-run-id
  dataset_id: test-dataset-id
  organic_result_count: 10
  top_competitors:
    - position: 1
      title: Search Essentials
      url: https://developers.google.com/search/docs/essentials
      domain: developers.google.com
  people_also_ask: []
  related_queries: []
  autocomplete_suggestions: []
  validation_status: observed
sources:
  - title: Search Essentials
    url: https://developers.google.com/search/docs/essentials
    publisher: Google Search Central
    checked_at: 2026-09-01
media:
  - type: image
    src: /media/articles/newly-funded-founder/funding-announcement.svg
    alt: Funding announcement evidence workflow
    caption: A source-controlled announcement workflow.
    credit: VideoClaw editorial illustration
    rights: owned
cta:
  label: Check your source pack
  href: /#source-pack
review:
  seo_checked: false
  evidence_checked: false
  editorial_checked: false
  media_checked: false
  checked_at: null
related_articles: []
---
The useful answer appears here.

## Build the source pack

Use approved facts before creating audience variants.
`;
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm test lib/content/articles.test.ts`

Expected: FAIL because `article-schema.ts` and `articles.ts` do not exist.

- [ ] **Step 4: Implement the schema, parser, and loader**

Use Zod enums for the exact campaign, funnel, intent, status, indexing, provider, SERP provider, and validation-state values in the spec. `parseArticleSource` calls `matter(source)`, validates `data`, rejects raw `<script`, `<iframe`, and event-handler HTML, verifies `canonical_path === /blog/${slug}`, and returns `{ frontmatter, body, filePath }`.

`getAllArticles` recursively reads only `.md` files under `content/articles`, sorts by `article_id`, and validates the complete result. It throws one aggregated error when invalid so production builds fail closed.

`getPublishableArticles` returns only records satisfying every article gate and the global indexing flag.

- [ ] **Step 5: Run GREEN verification and commit**

Run: `pnpm test lib/content/articles.test.ts && pnpm run typecheck`

Expected: focused tests pass and TypeScript reports no errors.

```bash
git add package.json pnpm-lock.yaml lib/content content/articles/.gitkeep
git commit -m "feat: add validated markdown article loader"
```

### Task 2: Deterministic editorial QA and keyword-provider contract

**Files:**
- Create: `lib/seo/article-audit.ts`
- Create: `lib/seo/article-audit.test.ts`
- Create: `lib/keywords/provider.ts`
- Create: `lib/keywords/provider.test.ts`
- Create: `docs/research/2026-09-01-keyword-provider-comparison.md`

**Interfaces:**
- Consumes: `ArticleRecord` and frontmatter types from Task 1.
- Produces: `auditArticle(article, assetExists)`, `isArticlePublishable(article, audit, globalIndexing)`, `KeywordObservation`, `normalizeKeywordImport(row)`, and `KEYWORD_PROVIDERS`.
- `auditArticle` returns category scores for `technical`, `attribution`, `evidence`, `media`, and `keyword`, plus `blockingFindings` and `advisoryFindings`.

- [ ] **Step 1: Write failing audit tests**

Create literal article fixtures and assert:

```ts
expect(auditArticle(validDraft, () => true).categories.attribution.score).toBe(100);
expect(auditArticle(validDraft, () => false).blockingFindings).toContainEqual(
  expect.objectContaining({ code: 'media.asset_missing' }),
);
expect(isArticlePublishable(validDraft, auditArticle(validDraft, () => true), true)).toBe(false);
```

Add independent tests for title length 30–65, description length 120–170, lowercase hyphenated slug, at least two H2 headings, minimum 600 words, external-link citation presence, local media, non-empty alt/caption/credit/rights, and pending authenticated metrics. A fully approved fixture with validated Semrush evidence must become publishable only when the global flag is true.

- [ ] **Step 2: Write failing provider normalization tests**

Assert a Semrush row normalizes to this literal shape and that missing numeric values stay null:

```ts
expect(normalizeKeywordImport({
  provider: 'semrush', keyword: 'demo day video checklist', country: 'US',
  observed_at: '2026-09-01', volume: 90, difficulty: 31, cpc: 4.2,
  intent: 'informational',
})).toEqual({
  provider: 'semrush', keyword: 'demo day video checklist', country: 'US',
  observedAt: '2026-09-01', volume: 90, difficulty: 31, cpc: 4.2,
  intent: 'informational', validationStatus: 'validated',
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts`

Expected: FAIL because the audit and provider modules do not exist.

- [ ] **Step 4: Implement transparent checks and provider adapter**

Each category score is `Math.round(passedChecks / totalChecks * 100)`. Blocking codes and thresholds are exported constants so the content-map can explain every result. Provider normalization rejects negative volume/CPC, difficulty outside 0–100, non-US country for this campaign, and provider `pending` with numeric metrics.

Document official API capabilities, current access model, metric strengths, limitations, and the recommendation order Semrush → Ahrefs → Similarweb plus post-publication Google Search Console. Link only official documentation and distinguish API facts from the recommendation.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test lib/seo/article-audit.test.ts lib/keywords/provider.test.ts && pnpm run typecheck`

```bash
git add lib/seo lib/keywords docs/research/2026-09-01-keyword-provider-comparison.md
git commit -m "feat: add article QA and keyword provider contracts"
```

### Task 3: Markdown renderer and article attribution panel

**Files:**
- Create: `app/blog/[slug]/page.tsx`
- Create: `app/blog/[slug]/page.test.tsx`
- Create: `app/blog/[slug]/article-markdown.tsx`
- Create: `app/blog/[slug]/article-attribution.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `getAllArticles`, `getArticleBySlug`, `auditArticle`, and the existing campaign URLs.
- Produces: statically generated `/blog/<slug>` routes, dynamic metadata, safe Markdown rendering, JSON-LD publication gating, and a review attribution panel.

- [ ] **Step 1: Write failing page tests**

Mock only the filesystem loader boundary with a complete `ArticleRecord`. Render the real page and assert one H1 from frontmatter, Markdown H2/list/table/link rendering, visible campaign/ICP/keyword/competitor-gap/QA attribution, CTA, source list, media caption, and no canonical or Article JSON-LD for a pending draft.

Test `generateStaticParams` returns one literal `{ slug }` per record and `generateMetadata` returns `{ robots: { index: false, follow: false } }` for the draft.

- [ ] **Step 2: Run the route test and verify RED**

Run: `pnpm test 'app/blog/[slug]/page.test.tsx'`

Expected: FAIL because the route components do not exist.

- [ ] **Step 3: Implement the server route and safe renderer**

Use `ReactMarkdown` with `remarkGfm`; do not enable `rehypeRaw`. Custom link rendering permits `https://`, `http://`, `/`, and `#` only, adding `rel="noopener noreferrer"` to external links. Custom image rendering permits `/media/articles/` only and uses `next/image` with width 1200, height 675, and responsive sizes.

Await `params` in both the page and `generateMetadata`. Call `notFound()` for unknown slugs. Use `generateStaticParams` over the complete review library. Emit Article JSON-LD and canonical only after `isArticlePublishable` returns true.

- [ ] **Step 4: Add the editorial visual system**

Namespace rules under `.article-page` and `.article-attribution`. Preserve the existing black, warm-paper, and acid-green design language, readable 65–75 character measure, visible source cards, accessible focus states, responsive tables, and reduced-motion behavior.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test 'app/blog/[slug]/page.test.tsx' && pnpm run typecheck && pnpm run lint`

```bash
git add 'app/blog/[slug]' app/globals.css
git commit -m "feat: render traceable markdown articles"
```

### Task 4: SEO content map and workflow diagram

**Files:**
- Create: `app/seo/content-map/page.tsx`
- Create: `app/seo/content-map/page.test.tsx`
- Create: `app/seo/content-map/content-map.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: all article records and audits.
- Produces: noindex operational route `/seo/content-map` with 250-row inventory, deterministic totals, blocker explanations, source links, rendered-page links, and workflow diagram.

- [ ] **Step 1: Write failing content-map tests**

Provide a complete five-record cross-campaign fixture to the real table component and assert five rows, five campaign labels, pending keyword badges, technical/attribution/evidence/media/keyword scores, blocker text, article links, source paths, and the workflow labels `Research signals`, `Keyword validation`, `Markdown source`, `Editorial QA`, `Rendered page`, and `Sitemap gate`.

Assert route metadata is always noindex/nofollow and totals are calculated from records rather than hard-coded.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test app/seo/content-map/page.test.tsx`

Expected: FAIL because the content-map route does not exist.

- [ ] **Step 3: Implement the operational screen**

Render summary cards for total articles, counts per campaign, publishable count, pending keyword count, and blocking-issue count. Render a semantic table with one row per article and native controls for campaign, funnel, and status filtering in a small client component. The workflow diagram uses semantic HTML/CSS and remains readable without JavaScript.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test app/seo/content-map/page.test.tsx && pnpm run typecheck && pnpm run lint`

```bash
git add app/seo/content-map app/globals.css
git commit -m "feat: add SEO content map and attribution workflow"
```

### Task 5: Live Apify candidate discovery and US SERP evidence

**Files:**
- Create: `lib/keywords/apify-evidence.mjs`
- Create: `lib/keywords/apify-evidence.test.ts`
- Create: `scripts/research/collect-apify-evidence.mjs`
- Create: `data/research/apify/run-manifest.json`
- Create: `data/research/apify/newly-funded-founder.json`
- Create: `data/research/apify/accelerator-demo-day-founder.json`
- Create: `data/research/apify/video-production-comparison.json`
- Create: `data/research/apify/gtm-content-repurposing-buyer.json`
- Create: `data/research/apify/portfolio-media-platform.json`

**Interfaces:**
- Consumes: the five 50-opportunity research matrices plus runtime `APIFY_TOKEN`.
- Produces: `normalizeAutocompleteItem(item)`, `normalizeSerpItem(item, provenance)`, `rankObservedOpportunity(record)`, five normalized candidate/SERP datasets, and a run manifest containing Actor, run, dataset, country, language, and observation timestamps.

- [ ] **Step 1: Write failing evidence-normalization tests**

Use hand-written Apify fixtures and assert that autocomplete output preserves keyword, suggestion, parent, depth, country, language, and scraped timestamp. Assert that SERP output preserves query, US locale, observation time, first-page competitors with positions/domains, People Also Ask questions, related queries, Actor ID, run ID, and dataset ID.

Prove that `rankObservedOpportunity` uses only observable fields and returns this transparent shape:

```ts
{
  query: 'backup product demo video',
  relevance: 3,
  exactTitleMatches: 0,
  articleResults: 4,
  videoOrSocialResults: 3,
  peopleAlsoAskCount: 4,
  relatedQueryCount: 8,
  evidenceScore: 18,
  scoreExplanation: [
    'ICP relevance: 3/3',
    'Exact-title saturation: 0/10',
    'People Also Ask questions: 4',
    'Related queries: 8',
  ],
}
```

The score must never include or imply volume, difficulty, CPC, traffic potential, or ranking probability.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test lib/keywords/apify-evidence.test.ts`

Expected: FAIL because the evidence normalizer does not exist.

- [ ] **Step 3: Implement normalizers, redaction, and the collection CLI**

The CLI accepts `--campaign`, `--matrix`, and `--out`. It reads `APIFY_TOKEN` from the process environment, never command-line arguments, and throws when missing. It redacts authorization values from errors. It uses `automation-lab/google-autocomplete-scraper` for discovery and Apify-maintained `apify/google-search-scraper` for SERPs.

Autocomplete settings are US/en, ten campaign seeds, depth 1, ten suggestions, and alphabet expansion. SERP settings are US/en desktop, one page per query, unfiltered results off, ads off, lead enrichment off, website content off, and paid AI add-ons off.

- [ ] **Step 4: Expand and normalize at least 100 candidates per campaign**

Combine the matrix primary/secondary queries with autocomplete suggestions. Normalize case and whitespace, remove navigational noise and unrelated celebrity/event meanings, require a campaign-specific anchor, deduplicate, and retain 100–200 candidates for each campaign. Record rejected queries and reasons; do not silently discard ambiguous results.

- [ ] **Step 5: Collect first-page US Google evidence**

Run one SERP request per retained candidate. Persist the first ten organic results, result types, titles, URLs, snippets, People Also Ask questions, related queries, observation time, Actor, run, and dataset IDs. Preserve the raw Apify dataset IDs in `run-manifest.json` so the complete external result can be audited without committing credentials.

- [ ] **Step 6: Select 50 observed opportunities per campaign**

Use ICP relevance, intent fit, exact-title saturation, result composition, PAA/related-query evidence, and the defensible VideoClaw content gap. Keep exactly 50 per campaign, document the selection rationale, and mark every proprietary keyword metric pending. A broad/noisy seed such as `demo day video` may remain research evidence but must not be selected merely because it was a seed.

- [ ] **Step 7: Verify and commit**

Run: `pnpm test lib/keywords/apify-evidence.test.ts && pnpm run typecheck && git grep -n 'apify_api_' -- ':!pnpm-lock.yaml'`

Expected: evidence tests and typecheck pass; credential grep returns no matches.

```bash
git add lib/keywords/apify-evidence.mjs lib/keywords/apify-evidence.test.ts scripts/research data/research/apify
git commit -m "research: validate article opportunities with live US SERPs"
```

### Task 6: Five 50-article campaign libraries and owned editorial media

**Files:**
- Create: `content/articles/newly-funded-founder/*.md` (50 files)
- Create: `content/articles/accelerator-demo-day-founder/*.md` (50 files)
- Create: `content/articles/video-production-comparison/*.md` (50 files)
- Create: `content/articles/gtm-content-repurposing-buyer/*.md` (50 files)
- Create: `content/articles/portfolio-media-platform/*.md` (50 files)
- Create: `public/media/articles/newly-funded-founder/*.svg`
- Create: `public/media/articles/accelerator-demo-day-founder/*.svg`
- Create: `public/media/articles/video-production-comparison/*.svg`
- Create: `public/media/articles/gtm-content-repurposing-buyer/*.svg`
- Create: `public/media/articles/portfolio-media-platform/*.svg`
- Create: `content/article-library.test.ts`

**Interfaces:**
- Consumes: the exact frontmatter contract, loader, and auditor from Tasks 1–2.
- Produces: exactly 250 canonical Markdown records and campaign-owned explanatory diagrams.

- [ ] **Step 1: Write the failing whole-library acceptance test**

The test loads the real filesystem and asserts these literal totals:

```ts
expect(result.totals.all).toBe(250);
expect(result.totals.byCampaign).toEqual({
  'newly-funded-founder': 50,
  'accelerator-demo-day-founder': 50,
  'video-production-comparison': 50,
  'gtm-content-repurposing-buyer': 50,
  'portfolio-media-platform': 50,
});
expect(result.findings).toEqual([]);
```

Also assert global uniqueness of article ID, slug, title, and primary keyword; body word count of at least 600; at least two H2 headings; no raw HTML; no placeholder tokens; no invented numeric keyword metrics; observed Apify US SERP evidence with run/dataset provenance; all local media files exist; all external URLs parse; and every campaign contains at least one informational, commercial, and transactional article across top, middle, and bottom stages where appropriate.

- [ ] **Step 2: Run the library test and verify RED**

Run: `pnpm test content/article-library.test.ts`

Expected: FAIL with zero articles instead of 250.

- [ ] **Step 3: Author campaign 1 — newly funded founders**

Create ten five-article clusters covering funding-announcement media, post-round founder narrative, investor updates, recruiting after a round, category education, product-launch proof, founder thought leadership, customer-proof readiness, PR versus owned media, and a 30/60/90-day GTM media plan. IDs are `vc-c1-001` through `vc-c1-050`.

- [ ] **Step 4: Author campaign 2 — accelerator and Demo Day founders**

Create ten five-article clusters covering Demo Day video checklists, pitch video, backup product demos, 72-hour preflight, post-Demo-Day narrative, investor follow-up, launch-asset reuse, social clips, proof/source packs, and cohort timelines. IDs are `vc-c2-001` through `vc-c2-050`.

- [ ] **Step 5: Author campaign 3 — production-model comparison**

Create ten five-article clusters covering agency versus freelancer, in-house team cost, AI video agents, outsourcing versus hiring, editing workflow, approval controls, brand consistency, rights/security questions, capacity/turnaround, and a decision scorecard. IDs are `vc-c3-001` through `vc-c3-050`.

- [ ] **Step 6: Author campaign 4 — GTM content repurposing buyers**

Create ten five-article clusters covering repurposing workflow, webinars, podcasts, product demos, sales enablement, product marketing, multi-channel distribution, approvals, content operations, and measurement. IDs are `vc-c4-001` through `vc-c4-050`.

- [ ] **Step 7: Author campaign 5 — accelerator and VC platform leads**

Create ten five-article clusters covering cohort media systems, portfolio content operations, Demo Day media kits, founder visibility programs, reusable templates, governance, portfolio reporting, partner capacity, accelerator brand, and pilot rollout. IDs are `vc-c5-001` through `vc-c5-050`.

Every five-article cluster uses five different intent angles and one campaign-specific owned SVG diagram. Drafts cite authoritative sources and clearly identify recommendations as recommendations. Do not claim that VideoClaw presently performs an unverified capability.

- [ ] **Step 8: Run whole-library GREEN verification and commit**

Run: `pnpm test content/article-library.test.ts && pnpm test lib/content/articles.test.ts lib/seo/article-audit.test.ts`

```bash
git add content/articles content/article-library.test.ts public/media/articles
git commit -m "content: add five traceable 50-article campaigns"
```

### Task 7: Publication gates, sitemap, robots, and library navigation

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/robots.ts`
- Modify: `app/llms.txt/route.ts`
- Modify: `app/page.tsx`
- Create: `app/discovery-articles.test.ts`

**Interfaces:**
- Consumes: `getPublishableArticles` and the existing private-indexing policy.
- Produces: fail-closed search discovery files and review navigation to the article library/content map.

- [ ] **Step 1: Write failing discovery tests**

Assert that a review build returns an empty sitemap, disallows all crawlers, emits a private-review `llms.txt`, and never leaks draft article URLs. With a synthetic fully publishable article and exact global flag `true`, assert the sitemap contains only that canonical article URL.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test app/discovery-articles.test.ts`

Expected: FAIL because discovery does not consume the article gate.

- [ ] **Step 3: Implement discovery and navigation**

Build sitemap records only from `getPublishableArticles`. Keep `/seo/content-map` excluded under every configuration. Add review-only navigation from the home page to the content map and representative article pages without changing the verified alpha-access URL.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test app/discovery-articles.test.ts && pnpm run typecheck && pnpm run lint`

```bash
git add app
git commit -m "feat: gate article discovery and add review navigation"
```

### Task 8: End-to-end verification and existing Vercel review deployment

**Files:**
- Create: `docs/qa/2026-09-01-markdown-content-engine-verification.md`
- Create: `docs/qa/screenshots/article-desktop.png`
- Create: `docs/qa/screenshots/article-mobile.png`
- Create: `docs/qa/screenshots/content-map-desktop.png`

**Interfaces:**
- Consumes: complete library and deployment configuration.
- Produces: fresh verification evidence and a corrected deployment on `videoclaw-demo-day-review`.

- [ ] **Step 1: Run the complete local verification gate**

Run:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build:next
pnpm run build
```

Expected: every command exits 0, all 250 routes are generated or renderable, and no draft becomes indexable.

- [ ] **Step 2: Run representative HTTP and browser checks**

Start the production build and verify HTTP 200 for `/seo/content-map`, one representative article from each campaign, `/robots.txt`, `/sitemap.xml`, and `/llms.txt`. Verify an unknown article returns 404. Capture desktop and mobile screenshots and confirm one H1, metadata, source links, media caption, attribution, CTA, and noindex on representative articles.

- [ ] **Step 3: Deploy a preview to the existing Vercel project**

Use the repository’s existing `.vercel/project.json` binding. Create a preview deployment first, verify the same representative routes and noindex headers/metadata, and only then update the stable `videoclaw-demo-day-review.vercel.app` alias. Do not set the public-indexing flag.

- [ ] **Step 4: Record evidence and commit**

The QA record includes exact command output summaries, test totals, article counts, representative URLs, deployment ID, deployment URL, alias, robots result, sitemap result, and unresolved limitations such as pending paid keyword metrics and pending editorial approval.

```bash
git add docs/qa/2026-09-01-markdown-content-engine-verification.md docs/qa/screenshots
git commit -m "docs: verify 250 article review deployment"
```
