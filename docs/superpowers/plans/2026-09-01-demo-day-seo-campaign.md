# VideoClaw Demo Day SEO/AEO/GEO Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a private, measurable, US-focused Demo Day campaign with one use-case page, one answer-first guide, verified local videos, truthful schema, and a source-pack-to-private-alpha conversion path.

**Architecture:** Preserve the existing prototype and add two static App Router pages backed by small pure content/schema helpers, one reusable video client island, and one document-level analytics listener. Keep the review deployment noindex by default and allow public indexing only through an explicit production build flag.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Vinext/Vite, native HTML video, JSON-LD, Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-01-demo-day-seo-campaign-design.md`

## Global Constraints

- Only the main Site owner edits the Site checkout; specialist agents write reports outside it.
- Both campaign routes are static server components except for the video and analytics client islands.
- The verified access URL is exactly `https://videoclaw.com/alpha/download`.
- Preview indexing is `noindex, nofollow`; indexing requires `NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING=true` at build time.
- No claim of delivery speed, output quality, cost, unrestricted access, integration, funding result, customer result, or private-data policy is allowed.
- No external analytics package, cookie, user identifier, persistent storage, or analytics network request is introduced.
- Use only the existing verified local Demo Day media.
- New CSS is namespaced under `.campaign-page` or `.guide-page`.

---

### Task 1: Campaign contract and indexing policy

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `app/campaign-content.test.ts`
- Create: `app/campaign-content.ts`

**Interfaces:**
- Produces: `CAMPAIGN_URLS`, `CampaignFaq`, `isPublicIndexingEnabled(env?: string): boolean`, `campaignRobots(env?: string): Metadata['robots']`, `buildFaqSchema(faqs: CampaignFaq[]): object`, `buildBreadcrumbSchema(items: BreadcrumbItem[]): object`, and `formatCampaignEvent(input: CampaignEventInput): CampaignEvent`.

- [ ] **Step 1: Add Vitest and write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildFaqSchema, campaignRobots, formatCampaignEvent } from './campaign-content';

describe('campaign content contracts', () => {
  it('keeps previews out of search unless the production flag is exact', () => {
    expect(campaignRobots(undefined)).toEqual({ index: false, follow: false });
    expect(campaignRobots('false')).toEqual({ index: false, follow: false });
    expect(campaignRobots('true')).toEqual({ index: true, follow: true });
  });

  it('builds FAQ schema from the visible answer data', () => {
    expect(buildFaqSchema([{ question: 'Can I use a prototype?', answer: 'Yes, when it is labeled accurately.' }])).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ name: 'Can I use a prototype?', acceptedAnswer: { text: 'Yes, when it is labeled accurately.' } }],
    });
  });

  it('formats an anonymous page event', () => {
    expect(formatCampaignEvent({ event: 'page_view', pagePath: '/use-cases/demo-day-founder-content', timestamp: '2026-09-01T00:00:00.000Z' })).toEqual({
      event: 'page_view', page_path: '/use-cases/demo-day-founder-content', timestamp: '2026-09-01T00:00:00.000Z',
    });
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- app/campaign-content.test.ts`

Expected: FAIL because `campaign-content.ts` and its exports do not exist.

- [ ] **Step 3: Implement the pure contracts**

Create the exact exports above. Builders derive schema from supplied visible data. Event formatting maps camel-case inputs to the documented snake-case browser payload and omits absent optional fields.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- app/campaign-content.test.ts`

Expected: all campaign contract tests pass.

```bash
git add package.json pnpm-lock.yaml vitest.config.ts app/campaign-content.ts app/campaign-content.test.ts
git commit -m "feat: add campaign content contracts"
```

### Task 2: Local media and video instrumentation

**Files:**
- Create: `public/media/demo-day/base-16x9.mp4`
- Create: `public/media/demo-day/investor-16x9.mp4`
- Create: `public/media/demo-day/customer-16x9.mp4`
- Create: `public/media/demo-day/recruiting-16x9.mp4`
- Create: `public/media/demo-day/base-poster.jpg`
- Create: `public/media/demo-day/investor-poster.jpg`
- Create: `public/media/demo-day/customer-poster.jpg`
- Create: `public/media/demo-day/recruiting-poster.jpg`
- Create: `app/campaign-video.test.tsx`
- Create: `app/campaign-video.tsx`

**Interfaces:**
- Consumes: `formatCampaignEvent` from Task 1.
- Produces: `CampaignVideo({ id, src, poster, title, caption, preload? }): React.ReactElement`.

- [ ] **Step 1: Copy verified files and extract poster frames**

Copy only the four verified 16:9 sound files from `outputs/videoclaw-demo-day-continuity-pilot`. Extract one JPEG at 4 seconds from each copied MP4 with ffmpeg. Preserve source files unchanged.

- [ ] **Step 2: Write the failing component test**

Render `CampaignVideo` and assert the native player has controls, `playsInline`, the supplied poster and accessible label, and a visible caption. Dispatch `play` and native `ended` events and assert one `videoclaw:analytics` event for each documented video event; seeking near the end must not count as completion.

- [ ] **Step 3: Run the focused test and verify failure**

Run: `npm test -- app/campaign-video.test.tsx`

Expected: FAIL because `CampaignVideo` does not exist.

- [ ] **Step 4: Implement the component and pass tests**

Use one ref and a completion guard. Do not autoplay. Use `preload="metadata"` only when requested; otherwise default to `none`.

Run: `npm test -- app/campaign-video.test.tsx`

Expected: all video tests pass.

### Task 3: Use-case route and first meaningful preview

**Files:**
- Create: `app/use-cases/demo-day-founder-content/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: campaign URLs/schema builders from Task 1 and `CampaignVideo` from Task 2.
- Produces: static route `/use-cases/demo-day-founder-content`.

- [ ] **Step 1: Write a failing rendered-page acceptance test**

Render the page to static markup and assert one H1, the exact alpha URL, a link to `/#source-pack`, four viewer jobs, three audience variants plus the base prototype, visible FAQ answers, and public-schema contracts limited to `FAQPage`, `BreadcrumbList`, and `WebPage`.

- [ ] **Step 2: Run the route test and verify failure**

Run: `npm test -- app/use-cases/demo-day-founder-content/page.test.tsx`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the complete use-case page and namespaced CSS**

Use the approved answer-first copy, explicit qualification line, base proof video, three supporting variants, measurement-protocol block, six visible FAQs, source-pack handoff, and private-alpha disclosure. Add no unsupported claim.

- [ ] **Step 4: Verify and open the first preview**

Run: `npm test -- app/use-cases/demo-day-founder-content/page.test.tsx && npm run build`

Expected: route test passes and Next reports the use-case route as static.

Start the local server, confirm HTTP 200, and open the exact route in the Codex preview panel before continuing.

### Task 4: Answer-first guide

**Files:**
- Create: `app/guides/founder-story-after-demo-day/page.test.tsx`
- Create: `app/guides/founder-story-after-demo-day/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: campaign URLs, FAQ/schema builders, and indexing policy from Task 1.
- Produces: static route `/guides/founder-story-after-demo-day`.

- [ ] **Step 1: Write the failing rendered-page acceptance test**

Assert the rendered article includes the exact primary H1, a two-sentence direct answer, the eight source inputs, four format distinctions, the 72-hour preflight, the 90-second founder/product/evidence template, the 14-day sequence, six FAQs, and links to both the use-case and source-pack diagnostic.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- app/guides/founder-story-after-demo-day/page.test.tsx`

Expected: FAIL because the guide route does not exist.

- [ ] **Step 3: Implement the guide and pass tests**

Keep all answer blocks in rendered HTML. Keep preview JSON-LD absent; the public schema contract is limited to `WebPage`, `BreadcrumbList`, and route-scoped `FAQPage` data that matches visible text. Do not invent an author biography, customer result, or publication history.

- [ ] **Step 4: Verify and commit both route slices**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, lint is clean, and both new routes are static.

```bash
git add app public/media/demo-day
git commit -m "feat: build demo day campaign routes"
```

### Task 5: Analytics, discovery files, and prototype handoff

**Files:**
- Create: `app/campaign-event-tracker.test.tsx`
- Create: `app/campaign-event-tracker.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/source-pack-check.tsx`
- Modify: `app/page.tsx`
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Create: `public/llms.txt`

**Interfaces:**
- Consumes: `formatCampaignEvent`, `campaignRobots`, and `CAMPAIGN_URLS` from Task 1.
- Produces: one anonymous document-level analytics event bus and search-discovery outputs that honor the private-preview flag.

- [ ] **Step 1: Write failing analytics tests**

Render the tracker in jsdom, click a `data-vc-event="alpha_download_click"` link, and assert exactly one `videoclaw:analytics` event and one matching `dataLayer` payload. Assert page-view deduplication, query/fragment stripping, and no network, beacon, cookie, or storage side effect.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- app/campaign-event-tracker.test.tsx`

Expected: FAIL because the tracker does not exist.

- [ ] **Step 3: Implement analytics and discovery outputs**

Mount the tracker once in `layout.tsx`. Update the source-pack diagnostic to emit `source_pack_complete` at the first transition to eight checks. Correct the two existing access links to the exact alpha URL and link the prototype to the new use-case and guide routes. Keep route metadata, response headers, robots, sitemap, JSON-LD, canonical, and `llms.txt` fail-closed unless the production flag is exact and the publication gate is approved.

- [ ] **Step 4: Run the full verification set and commit**

Run: `npm test && npm run lint && npm run build`

Expected: all checks pass without warnings or errors.

```bash
git add app public/llms.txt
git commit -m "feat: add campaign measurement and discovery controls"
```

### Task 6: Private deployment and acceptance audit

**Files:**
- Create: `docs/qa/2026-09-01-demo-day-campaign-verification.md`

**Interfaces:**
- Consumes: the complete campaign build and external specialist reports.
- Produces: a deployed private preview URL and an evidence-based verification record.

- [ ] **Step 1: Run final local verification**

Run tests, lint, production build, and local HTTP checks for `/`, `/use-cases/demo-day-founder-content`, `/guides/founder-story-after-demo-day`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and all four MP4 assets.

- [ ] **Step 2: Review claims and schema against specialist reports**

Check every product statement against `22-VIDEOCLAW-PRODUCT-TRUTH-AUDIT.md`, every FAQ schema answer against visible text, every CTA destination, and every indexing safeguard. Record observed results in the QA document.

- [ ] **Step 3: Deploy a private preview**

Use the project’s configured preview hosting. Do not promote to production and do not enable the public-indexing flag. Verify both deployed campaign paths return 200 and retain noindex/nofollow.

- [ ] **Step 4: Final review and commit**

```bash
git add docs/qa/2026-09-01-demo-day-campaign-verification.md
git commit -m "docs: verify demo day campaign preview"
```
