# Task 3 report — Markdown article route

Status: complete

## Implemented

- Added the async App Router page at `/blog/[slug]`, backed by `getAllArticles` and `getArticleBySlug`.
- Added literal-record focused tests without requiring the unfinished 250-file library.
- Rendered canonical Markdown with `react-markdown` and `remark-gfm`; raw HTML is skipped.
- Added protocol allowlists for Markdown links, frontmatter links, and CTAs.
- Restricted Markdown and frontmatter media rendering to source-controlled `/media/articles/` paths.
- Added one frontmatter-owned H1, editorial reading styles, responsive tables, code, lists, headings, local images/video, source cards, CTA, and reduced-motion handling.
- Added readable ICP, trigger, funnel, intent, keyword, keyword-provider state, competitor gap, Apify observation, ranking competitors, sources, media-rights, review-state, and deterministic-QA attribution.
- Added exact `/blog/<slug>` canonical and Article JSON-LD emission only when `isArticlePublishable` passes; drafts remain `noindex, nofollow` with no canonical or JSON-LD.
- Added `notFound()` handling for unknown slugs and one static param per loaded record.

## TDD evidence

- RED: `pnpm test 'app/blog/[slug]/page.test.tsx'` failed because `./page` did not exist.
- GREEN: focused route suite passes 6/6 tests.
- `pnpm run typecheck` passes.
- `pnpm run lint` passes.
- `git diff --check -- app/globals.css` passes.

## Self-review

- No raw-HTML renderer or `rehypeRaw` integration exists.
- JSON-LD serialization escapes `<` before entering the script element.
- Remote Markdown images and unsafe link protocols render as inert review notices/text.
- The publication decision delegates to the shared deterministic audit and global indexing gate; route code does not invent an independent SEO score.
- All implementation changes remain inside the Task 3 file boundary.

## Concerns and boundaries

- The complete 250-file content library is intentionally not required by focused tests and was not created in this task.
- A production build is an integrated later-task gate because `generateStaticParams` correctly consumes the complete library contract.
- Concurrent Apify evidence, scripts, data, matrices, and content/schema work were not modified or staged.

## Fix round 1 — publishable metadata and CTA review

- Verified the review finding with a complete publishable record and a real temporary owned-media fixture; the prior canonical and Open Graph values were relative.
- Added an absolute URL resolver rooted at `https://videoclaw.com` without changing global layout metadata.
- Added positive route coverage proving `index,follow`, absolute canonical, absolute Open Graph URL, and gated Article JSON-LD values.
- Added negative coverage proving the same individually publishable record remains `noindex,nofollow` with no canonical, Open Graph URL, or JSON-LD while the global indexing flag is off.
- JSON-LD intentionally contains no image, author URL, `datePublished`, or `dateModified` fields because the article schema does not provide approved values.
- Removed the generic hard-coded CTA heading and reduced the CTA footer to the article-specific frontmatter label and destination.
- TDD RED evidence: the positive fixture received relative metadata URLs; the fail-closed object retained an `url: undefined` property; and the generic CTA heading remained visible.
- GREEN evidence: focused route suite passes 9/9; typecheck and lint pass; scoped whitespace checks pass.
