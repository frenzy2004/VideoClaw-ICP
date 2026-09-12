# Manual batch QA — September 12, 2026

## Result

**50 complete review-only articles; ten per ICP.** Final body total: 59,857 words
(1,112–1,395 per article). Each has three FAQs, at least two cited sources, exact
US/en SERP provenance, related guides, a product-video/poster mapping and its own
editorial SVG. None is published or team-approved.

## Verified checks

| Check | Result |
|---|---|
| Batch content audit | 50/50 pass; unique article and graphic hashes; valid source/related links; no secret-shaped values or unsafe SVG constructs |
| Cross-batch repetition heuristic | No pair reaches 12% containment of normalized eight-word shingles; not an exhaustive plagiarism or duplicate-intent guarantee |
| Independent editorial reviews | All five campaigns reviewed by agents other than their authors; one required resizing correction and one optional wording correction resolved |
| Native lander contract | 50/50 pass against actual lander code at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; 53 combined review articles; zero published |
| Production visibility | Every new article is unavailable through the production-mode native lookup; all approval flags false, no publication dates |
| Native lander tests | 32/32 blog tests pass; app-update, gateway (10 checks), and acquisition checks pass |
| Native lint/build | Both pass; final `VERCEL_ENV=preview` optimized build generates 75 total routes including all article pages |
| Worker regression suite | 2,988 tests pass across 69 files; lint and typecheck pass; existing Vite build passes with its existing dynamic-import warnings |
| Local HTTP audit | 50/50 article URLs return 200, each with canonical, noindex, one H1 and /download link; index links to all 50 |
| Local media HTTP audit | All 56 referenced assets return 200: 50 SVGs plus three video/poster pairs |
| Discovery safety | Local preview robots disallow crawling; sitemap and llms exclude draft article URLs; /download returns 200; unknown article returns 404 |

Machine-readable receipts: `content-audit.json`, `native-contract-report.json`,
`http-audit.json`, `inventory.json` and `source-audit.json`.

## Browser scope and limits

Inspected the blog index and funding article at desktop and the funding,
Demo Day pitch, freelance-rate, resizing and portfolio-newsletter articles at
390px mobile. Each of those five article checks reported viewport width equal to
document scroll width (no horizontal page overflow), one H1, video controls
enabled and autoplay disabled. Keyboard focus on the masthead link is visibly
outlined at 3px. No browser console/page errors were reported in that sample.

The founder video reached readyState 4 with no media error. The generated
funding graphic decoded at its native 1200px width. This does not certify every
frame or caption in the three reused videos. All fifty pages received HTTP and
native-contract checks, **not fifty separate visual browser reviews**.

A bulk browser sweep was abandoned after the browser session relaunched to
about:blank. Its initial image check also incorrectly counted off-screen lazy
images as missing; those are normal lazy-loading behavior. Neither aborted run
is counted as a pass, and its temporary helper is not part of this delivery.

The sampled axe WCAG A/AA audit reported **zero violations, two incomplete rules**:
gradient-background contrast needs manual inspection, and video captions need
media review. No Lighthouse score or complete accessibility certification is
claimed. The native server also logged `Internal: NoFallbackError` when probing
an unknown slug, although the HTTP response was the required 404; no lander-code
change was made to hide that baseline behavior.

## Editorial and search limitations

- Paid volume, keyword difficulty and CPC remain provider-pending.
- Search evidence is organic-result observation, not proof of demand or ranking.
- 35/150 FAQ questions exactly match observed PAA; 115 are editorial.
- Source transport retrieved 41/64 bodies automatically. Twenty-three required
  separate web-reading checks; see `SOURCE-VERIFICATION.md`. No failed automatic
  receipt was rewritten as success.
- Three titles exceed the advisory 65-character display threshold. This is a
  copy-review warning, not a Google indexing rule or validation failure.
- Mixed-intent and tool-heavy topics remain flagged in `SEARCH-INTENT-NOTES.md`.
- Product footage is existing VideoClaw material, not evidence that the fictional
  businesses in the articles are VideoClaw customers.

## Isolation proof

- All new files are under `manual-batches/2026-09-12-50/` on
  `content/manual-review-batch-50`.
- Original lander worktree remains clean on `seo/founder-video-blog-launch`;
  PR #55 remains open at `b6b0833`.
- Worker branch remains `3bd98f5`; `seo-campaign` remains `44b3984`;
  remote state branch remains `4cd9ff5`.
- Local worker state SHA-256 remains
  `8332cb2bb5de560646b165c9843df6538f61797c97bf05ddcb376aee54f8419d`.
- No worker pilot, retry reset, generated lander PR, merge, schedule activation,
  production edit, publishing, indexing submission or deployment occurred.

This completes the requested manual review batch. It does **not** complete or
prove unattended autoblogger operation, paid keyword enrichment, production
approval, or search indexing.
