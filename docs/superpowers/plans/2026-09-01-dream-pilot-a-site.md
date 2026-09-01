# Dream Pilot A Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanently private Dream Pilot A dossier and an initially private physical-AI Demo Day guide to the existing VideoClaw Campaign 2 review site.

**Architecture:** Extend the existing Next.js App Router campaign framework. One shared data module owns facts, sources, claim states, prompts, and templates; each route remains a Server Component with static metadata. Route-specific metadata and response headers enforce permanent noindex independently from the global public-indexing flag, while existing sitemap, `llms.txt`, and anonymous analytics allowlists remain explicit.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Vitest, Testing Library, CSS, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-01-dream-pilot-a-site-design.md`

## Global Constraints

- `/pilots/dream-demo-day` and `/guides/physical-ai-product-demo-before-demo-day` must return `noindex, nofollow` metadata and `X-Robots-Tag` headers when `NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING` is either unset, false, or exactly true.
- Neither new route may appear in sitemap or `llms.txt` in this release.
- Do not include Dream logos, founder images, launch-video embeds, copied screenshots, personal contacts, or generated Dream product behavior.
- Every rendered Dream fact must include a direct public source URL and checked date `2026-09-01`.
- Do not imply Dream is a VideoClaw customer, participant, partner, or endorser.
- No customer/case-study/endorsement/product/organization structured data may be emitted for Dream.
- Analytics accept only stable VideoClaw-owned IDs; no company names, founder identifiers, contacts, URLs with query strings, or free text.
- The guide must contain no Dream-specific creative or participation implication.
- Use TDD: every production behavior starts with a focused failing test whose failure is observed and recorded.
- Preserve existing 49-test behavior and the four verified soundtrack masters.

---

### Task 1: Shared Pilot Data and Permanent Discovery Controls

**Files:**
- Create: `app/campaign-2-pilot-data.ts`
- Create: `app/campaign-2-pilot-data.test.ts`
- Modify: `app/campaign-content.ts`
- Modify: `app/campaign-content.test.ts`
- Modify: `app/discovery.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Produces `DREAM_PILOT_PATH`, `PHYSICAL_AI_GUIDE_PATH`, `dreamPilot`, `physicalAiGuide`, and `privateRobots()`.
- Extends `CAMPAIGN_URLS` with `dreamPilotPath`, `physicalAiGuidePath`, and same-origin absolute URLs.
- Extends safe page/href/article/link/CTA allowlists only for the two new VideoClaw routes and their stable interactions.
- Produces `buildSiteHeaders(publicIndexing: boolean)` for direct discovery-control testing.

- [ ] **Step 1: Write failing shared-control tests**

Add tests that require:

```ts
expect(privateRobots()).toEqual({ index: false, follow: false });
expect(buildSiteHeaders(true)).toEqual(expect.arrayContaining([
  expect.objectContaining({ source: '/pilots/dream-demo-day' }),
  expect.objectContaining({ source: '/guides/physical-ai-product-demo-before-demo-day' }),
]));
expect(sitemap().map((entry) => entry.url)).not.toEqual(expect.arrayContaining([
  'https://videoclaw.com/pilots/dream-demo-day',
  'https://videoclaw.com/guides/physical-ai-product-demo-before-demo-day',
]));
expect(llmsText(true)).not.toMatch(/dream-demo-day|physical-ai-product-demo/i);
```

Add data-contract tests that every `dreamPilot.publicFacts` item has `sourceUrl`, `checkedAt: '2026-09-01'`, `safeUse`, and `notSupported`; all approved claims are disjoint from prohibited claims; and both route constants have the exact paths above.

- [ ] **Step 2: Run tests and observe RED**

Run: `pnpm vitest run app/campaign-2-pilot-data.test.ts app/campaign-content.test.ts app/discovery.test.ts`

Expected: FAIL because the pilot module, `privateRobots`, URL fields, and `buildSiteHeaders` do not exist.

- [ ] **Step 3: Implement minimal shared data and controls**

Create typed, immutable arrays for public facts, source-pack fields, claim states, storyboard beats, search terms, answer prompts, and guide sections. Add `privateRobots()` returning static false/false. Refactor `next.config.ts` so `buildSiteHeaders(publicIndexing)` always adds route-specific noindex headers and adds global noindex headers only when public indexing is disabled. Extend existing allowlists with stable VideoClaw-owned IDs only.

- [ ] **Step 4: Run focused tests and observe GREEN**

Run: `pnpm vitest run app/campaign-2-pilot-data.test.ts app/campaign-content.test.ts app/discovery.test.ts`

Expected: all focused tests pass with pristine output.

- [ ] **Step 5: Run the full suite and commit**

Run: `pnpm test`

Commit: `feat: add pilot data and permanent discovery controls`

---

### Task 2: Private Dream Pilot A Dossier

**Files:**
- Create: `app/pilots/dream-demo-day/page.tsx`
- Create: `app/pilots/dream-demo-day/page.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes `dreamPilot`, `DREAM_PILOT_PATH`, `privateRobots`, `CAMPAIGN_URLS`, and the existing `CampaignVideo` component.
- Produces a Server Component route with static noindex metadata and no structured-data script.

- [ ] **Step 1: Write failing page tests**

Require static metadata to equal `{ index: false, follow: false }`; render the page and assert a visible `PRIVATE ACCOUNT DOSSIER · NOINDEX · NON-AFFILIATED` notice, public-source links, checked dates, selection rationale, exclusions, qualification gate, seven-beat storyboard, source-pack matrix, claim ledger, prohibited implications, audience variants, query/prompt panels, measurement table, and production-authorization decision.

Assert the rendered document contains no `application/ld+json`, no Dream image/logo/embed, no mail/phone/contact data, and the generic-video caption:

```text
VideoClaw campaign-method illustration only. This is not Dream footage, a Dream product demonstration, or evidence of Dream participation.
```

- [ ] **Step 2: Run the page test and observe RED**

Run: `pnpm vitest run app/pilots/dream-demo-day/page.test.tsx`

Expected: FAIL because the route module does not exist.

- [ ] **Step 3: Implement the minimal dossier**

Build the route from the shared data module. Use semantic headings, tables or definition lists, source links beside facts, a skip link, keyboard-accessible native disclosure elements where useful, and existing campaign styling primitives. Embed only the verified generic VideoClaw base master through the existing component and exact boundary caption.

- [ ] **Step 4: Run the page test and observe GREEN**

Run: `pnpm vitest run app/pilots/dream-demo-day/page.test.tsx`

Expected: all dossier tests pass with pristine output.

- [ ] **Step 5: Run the full suite and commit**

Run: `pnpm test`

Commit: `feat: add private Dream pilot dossier`

---

### Task 3: Physical-AI Demo Day Guide and Markdown Download

**Files:**
- Create: `app/guides/physical-ai-product-demo-before-demo-day/page.tsx`
- Create: `app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx`
- Create: `app/guides/physical-ai-product-demo-before-demo-day/download/route.ts`
- Create: `app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts`
- Modify: `app/use-cases/demo-day-founder-content/page.tsx`
- Modify: `app/use-cases/demo-day-founder-content/page.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes `physicalAiGuide`, `PHYSICAL_AI_GUIDE_PATH`, `privateRobots`, and `CAMPAIGN_URLS`.
- Produces an answer-first Server Component guide and a GET route returning `text/markdown; charset=utf-8` with `Content-Disposition: attachment; filename="videoclaw-physical-ai-demo-day-preflight.md"`.
- Adds a stable review link from the existing Demo Day use-case page without exposing the private Dream dossier.

- [ ] **Step 1: Write failing guide and download tests**

Require noindex metadata; a direct answer of 40–70 words; the exact five-step story structure; rights/privacy/prototype/simulation/facility/identifier/screen-data controls; investor/customer matrix; 48-hour clock; 14-day sequence; visible source-pack and claim-ledger templates; AI-versus-human approval boundaries; measurement; limitations; dated sources; change log; and a working Markdown download link.

Call `GET()` and assert status 200, exact content type and filename, and Markdown containing the complete source-pack checklist, claim-control checklist, 48-hour clock, 14-day sequence, measurement section, and source URLs. Assert the guide contains no Dream-specific wording or media.

Require the existing use-case page to link to `/guides/physical-ai-product-demo-before-demo-day` using stable analytics IDs.

- [ ] **Step 2: Run focused tests and observe RED**

Run: `pnpm vitest run app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts app/use-cases/demo-day-founder-content/page.test.tsx`

Expected: FAIL because the guide/download route and review link do not exist.

- [ ] **Step 3: Implement the guide, download, and review link**

Generate visible guide sections and Markdown from the shared generic guide data so the download and HTML do not drift. Keep the route private in metadata and headers, omit schema, use semantic HTML, and add only stable analytics attributes already admitted by Task 1 allowlists.

- [ ] **Step 4: Run focused tests and observe GREEN**

Run: `pnpm vitest run app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts app/use-cases/demo-day-founder-content/page.test.tsx`

Expected: all focused tests pass with pristine output.

- [ ] **Step 5: Run full verification and commit**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`

Commit: `feat: add physical AI Demo Day guide`

---

### Task 4: Release Verification Record

**Files:**
- Create: `docs/qa/2026-09-01-dream-pilot-a-verification.md`

**Interfaces:**
- Consumes the final test, lint, typecheck, build, browser, and deployed-route evidence.
- Produces a dated release record with exact commands, results, route checks, deployment URL/ID, and indexing/discovery evidence.

- [ ] **Step 1: Run the complete local verification matrix**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`

Record exact test counts, command exit status, generated routes, and any warnings.

- [ ] **Step 2: Verify local routes in a real browser**

Check `/pilots/dream-demo-day`, `/guides/physical-ai-product-demo-before-demo-day`, its Markdown download, the existing use case, `robots.txt`, `sitemap.xml`, and `llms.txt`. Record HTTP status, title/H1, noindex metadata/header, primary interaction, console errors, and mobile/desktop layout result.

- [ ] **Step 3: Deploy and verify the production artifact**

Deploy the tested commit to Vercel production, inspect the deployment until READY, verify the stable production alias and both new routes, and scan deployment/runtime errors.

- [ ] **Step 4: Write and commit the release record**

Create the Markdown QA record using only observed evidence.

Commit: `docs: verify Dream pilot review release`
