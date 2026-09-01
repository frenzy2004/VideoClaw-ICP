# VideoClaw 250-Article Markdown Content Engine Design

## Outcome

Replace the current hard-coded guide experiment with a source-controlled publishing system for five US-focused customer campaigns. Each campaign contains exactly 50 distinct Markdown articles, producing exactly 250 human-readable article routes.

Markdown is the canonical content source. A page may not exist only as JSX copy. Every rendered article must be traceable back to the customer situation, funnel stage, search intent, keyword hypothesis, competitor gap, evidence, and media decisions that produced it.

The first release is a private review deployment on the existing `videoclaw-demo-day-review` Vercel project. All 250 routes render in review builds. Public indexing is a separate, per-article publication decision.

## Campaign model

The fixed campaign identifiers and audiences are:

1. `newly-funded-founder` — a US founder who has recently raised and needs a credible media presence and GTM content plan.
2. `accelerator-demo-day-founder` — a founder in YC or another US accelerator cohort preparing for Demo Day, launch, or fundraising.
3. `video-production-comparison` — a founder comparing an agency, freelancer, internal editor, and AI video agent.
4. `gtm-content-repurposing-buyer` — a startup marketing or GTM lead who has decided that the company needs AI video and content repurposing and is selecting a solution.
5. `portfolio-media-platform` — an accelerator or VC platform lead who needs a repeatable media system across a cohort or portfolio.

Each campaign has ten topic clusters and five non-overlapping intent angles per cluster, yielding 50 articles. The angle set is chosen per cluster from direct answer, checklist, workflow, comparison, template, cost, risk, timeline, measurement, and decision criteria. Two articles may not share the same primary keyword or near-identical title.

## Canonical Markdown contract

Article sources live at `content/articles/<campaign-id>/<slug>.md`. Each source has YAML frontmatter followed by substantive Markdown body copy.

Required frontmatter fields are:

```yaml
schema_version: 1
article_id: vc-c1-001
campaign_id: newly-funded-founder
icp: Newly funded US startup founder
customer_trigger: Closed a funding round and needs a credible media presence
funnel_stage: top
search_intent: informational
primary_keyword: startup announcement video strategy
secondary_keywords:
  - startup funding announcement content
title: How to Turn a Funding Announcement Into a Credible Video Story
description: A practical system for turning a startup funding announcement into reusable investor, customer, and recruiting content.
slug: funding-announcement-video-strategy
status: draft
indexing: noindex
canonical_path: /articles/funding-announcement-video-strategy
competitor_gap: Existing results explain press releases but not a source-controlled multi-audience video workflow.
keyword_evidence:
  provider: pending
  country: US
  observed_at: null
  volume: null
  difficulty: null
  cpc: null
  intent: informational
  validation_status: pending_paid_provider
sources:
  - title: Source title
    url: https://example.com/source
    publisher: Publisher
    checked_at: 2026-09-01
media:
  - type: image
    src: /media/articles/example.svg
    alt: Descriptive alternative text
    caption: Visible caption
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
```

Allowed `funnel_stage` values are `top`, `middle`, and `bottom`. Allowed `search_intent` values are `informational`, `commercial`, `transactional`, and `navigational`. Allowed `status` values are `draft`, `review`, and `publishable`. Allowed `indexing` values are `noindex` and `index`.

`keyword_evidence.provider` is `pending`, `semrush`, `ahrefs`, `similarweb`, or `gsc`. Numeric keyword fields remain `null` until observed from an authenticated provider. Scraped SERPs, autocomplete suggestions, social posts, or generated estimates must never be labeled as search volume or keyword difficulty.

## Article body contract

Every article body must:

- answer the primary query in the opening paragraph;
- have exactly one H1, supplied by the renderer from frontmatter rather than repeated in Markdown;
- contain at least two H2 sections and useful, audience-specific reasoning;
- include an actionable framework, checklist, comparison, template, or measurement method;
- distinguish verified facts from VideoClaw recommendations;
- cite every external factual claim with a source link;
- avoid invented customer results, product functionality, pricing, integrations, access promises, or delivery promises;
- include a contextual CTA that matches the funnel stage;
- avoid paragraphs reused verbatim across the library;
- contain no placeholder language such as TBD, TODO, or lorem ipsum.

An article is a reviewable editorial draft, not automatically approved marketing copy. Generated drafts remain `noindex` until the publication gate passes.

## Content loader and renderer

`lib/content/articles.ts` owns file discovery, frontmatter parsing, runtime validation, duplicate detection, and article lookup. Its public interfaces are:

```ts
export type ArticleRecord = { frontmatter: ArticleFrontmatter; body: string };
export function getAllArticles(): ArticleRecord[];
export function getArticleBySlug(slug: string): ArticleRecord | undefined;
export function getPublishableArticles(): ArticleRecord[];
export function validateArticleLibrary(records: ArticleRecord[]): LibraryValidationResult;
```

`app/articles/[slug]/page.tsx` renders statically generated pages from those records. It uses async route params, `generateStaticParams`, and `generateMetadata`. Metadata includes the title, description, robots, canonical only when indexable, Open Graph data, and `Article` JSON-LD only when the article is publishable and indexing is globally enabled.

Markdown supports paragraphs, H2–H4, lists, tables, blockquotes, links, inline code, fenced code, and local images. Raw HTML is disabled. External links receive safe attributes. Article media uses `next/image` with explicit dimensions or a controlled local editorial illustration component.

The current hard-coded physical-AI guide remains available for historical review but is not counted among the 250 Markdown articles.

## Attribution and editorial transparency

Each article page includes a private-review attribution panel showing campaign, ICP, trigger, funnel stage, primary keyword, keyword validation state, competitor gap, evidence count, media rights, and QA state. This panel is visible in review builds and can be hidden from public presentation without removing the source metadata.

`/seo/content-map` is a noindex operational screen containing all 250 records. It provides campaign, funnel, status, indexing, evidence, media, and keyword-validation filters; deterministic counts; links to the rendered page and source path; and the reason an article is not publishable.

## Deterministic SEO and evidence QA

`lib/seo/article-audit.ts` performs deterministic checks and never imitates a paid SEO score. It reports separate scores and findings for:

- technical SEO: title, description, slug, canonical, robots, heading structure, word count, links, image alt text, and metadata completeness;
- attribution: ICP, trigger, funnel, intent, keyword, competitor gap, and source provenance;
- evidence: valid source URLs, checked dates, unsupported-claim markers, and external-claim citations;
- media: asset existence, dimensions, alt text, caption, credit, and rights;
- keyword validation: provider state and whether volume/difficulty are authenticated observations.

The score is a transparent percentage of deterministic checks passed. It is labeled `VideoClaw editorial QA`, never `Google score`, `Ahrefs score`, or `ranking probability`.

An article becomes `publishable` only when:

- all required schema fields validate;
- technical, attribution, evidence, and media audits have no blocking findings;
- `keyword_evidence.validation_status` is `validated` from an authenticated provider;
- every review flag is true;
- `status` is `publishable` and `indexing` is `index`;
- the global production indexing flag is exactly `true`.

## Keyword-provider integration

`lib/keywords/provider.ts` defines a provider-neutral result shape. Semrush is the recommended first integration because one provider can supply keyword metrics, site-audit data, and position tracking. Ahrefs is the preferred alternative for keyword and competitor research. Similarweb is a supplementary source for clicks, zero-click behavior, traffic, and competitive context. Google Search Console becomes the first-party source after publication.

The initial build includes a documented import adapter for provider exports and a provider comparison screen/document. It does not require an API credential to render the 250-page review library. Pending metrics remain visibly pending.

No API key is stored in Markdown, committed files, browser JavaScript, screenshots, test fixtures, or logs. Provider credentials are server-only environment variables.

## Media

The library uses two media classes:

1. verified VideoClaw-owned local video and poster assets already in the repository;
2. source-controlled editorial diagrams generated specifically for this library and labeled as illustrations.

Third-party photography or logos are not downloaded or republished without an explicit license record. Embeds are optional and must record provider, source URL, caption, and rights rationale. Media presence alone does not increase the QA score unless provenance and accessibility fields pass.

## Sitemap, robots, and discovery

All review pages emit `noindex, nofollow`. `/seo/content-map` is always noindex. The XML sitemap contains only articles that pass the complete publication gate and only when `NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING=true`.

Human-readable article URLs use `/articles/<slug>`. Slugs are lowercase ASCII, 3–80 characters, hyphen-delimited, stable, and globally unique. Redirect planning is required before a published slug changes.

`llms.txt` may list only publishable articles and remains a private-review notice while global indexing is disabled.

## Verification and release

Automated verification must prove:

- exactly 250 valid Markdown sources exist;
- exactly 50 belong to each campaign;
- every article ID, slug, title, and primary keyword is unique;
- every source parses and renders without raw HTML;
- every article has attribution, keyword evidence state, sources, media provenance, CTA, and review state;
- no article is indexable while keyword validation or editorial approval is pending;
- static generation creates all 250 article routes;
- the content-map totals match the filesystem;
- sitemap and robots fail closed in review builds;
- tests, typecheck, lint, and both Next and Vite/Vinext production builds pass;
- representative desktop and mobile article pages, the content map, robots, and sitemap are checked in a deployed preview.

Production promotion or enabling the global indexing flag is outside this review release. The existing Vercel review project is updated only after local verification passes.

## Acceptance criteria

- The repository contains exactly 250 canonical Markdown article sources: 50 for each fixed campaign.
- Every Markdown source renders at a unique `/articles/<slug>` route with the approved editorial design.
- Every rendered page exposes its traceable attribution and deterministic QA result in review mode.
- `/seo/content-map` provides a complete 250-row operational view and workflow diagram.
- Paid keyword metrics are authenticated observations or explicit null/pending values; none are invented.
- All articles remain noindex until their individual and global gates pass.
- The corrected review build is deployed to the existing `videoclaw-demo-day-review` Vercel project.
