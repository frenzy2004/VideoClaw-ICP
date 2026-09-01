# Task 3: Physical-AI Demo Day Guide and Markdown Download

## Implementation

Added a permanently private, cross-company Physical-AI Demo Day preflight guide and a Markdown download. The HTML guide and Markdown route both render the existing `physicalAiGuide` data for the story sequence, controls, templates, audience matrix, activation clock, measurement, limitations, dated sources, and change log. The guide has no organization-specific media or wording, emits no schema, and the download returns an attachment with an explicit `X-Robots-Tag: noindex, nofollow` header.

The existing Demo Day founder-content use case now provides the one stable, allowlisted review link to the guide. Existing private dossier styling was left intact; guide styles were appended only.

## Files

- Created `app/guides/physical-ai-product-demo-before-demo-day/page.tsx`
- Created `app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx`
- Created `app/guides/physical-ai-product-demo-before-demo-day/download/route.ts`
- Created `app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts`
- Modified `app/use-cases/demo-day-founder-content/page.tsx`
- Modified `app/use-cases/demo-day-founder-content/page.test.tsx`
- Modified `app/globals.css`

## RED

Command:

```text
pnpm vitest run app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts app/use-cases/demo-day-founder-content/page.test.tsx
```

Observed failure as expected:

```text
Failed to resolve import "./page" from ".../physical-ai-product-demo-before-demo-day/page.test.tsx".
Failed to resolve import "./route" from ".../physical-ai-product-demo-before-demo-day/download/route.test.ts".
Unable to find an accessible element with the role "link" and name "Physical-AI guide".
Test Files 3 failed (3)
Tests 1 failed | 3 passed (4)
```

## GREEN

Command:

```text
pnpm vitest run app/guides/physical-ai-product-demo-before-demo-day/page.test.tsx app/guides/physical-ai-product-demo-before-demo-day/download/route.test.ts app/use-cases/demo-day-founder-content/page.test.tsx
```

Output:

```text
Test Files 3 passed (3)
Tests 7 passed (7)
```

## Full verification

Command:

```text
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

Output:

```text
Test Files 13 passed (13)
Tests 61 passed (61)
eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern .vercel: exit 0
next typegen && tsc --noEmit --incremental false --pretty false: Types generated successfully; exit 0
vite build: exit 0
```

## Self-review

- The direct answer is 49 words and the five story steps appear in the required order.
- HTML and Markdown consume the shared generic guide data; the full source-pack and claim-control checklists, two activation windows, measurement data, and source URLs are included in the download.
- The guide metadata is `noindex, nofollow`; the download response has `X-Robots-Tag: noindex, nofollow`. Existing discovery controls keep the guide out of `sitemap.ts` and `llms.txt`.
- The page has no JSON-LD, image, video, embed, or organization-specific wording/media. The use-case link uses only existing allowlisted IDs.
- `git diff --check` passed. The dossier CSS remains unchanged; only a new, namespaced guide stylesheet block was appended.

## Concerns

No functional concerns. The successful Vite build reports existing `INEFFECTIVE_DYNAMIC_IMPORT` warnings from Vinext entry/shim imports; they do not affect this guide and the build exits successfully.
