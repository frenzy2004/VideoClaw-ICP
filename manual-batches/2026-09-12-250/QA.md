# QA checkpoint — expansion in progress

This report covers the **99-article snapshot**, not the 250-article target.
It contains the retained fifty plus 49 additional drafts. Further authoring and
independent review are running; no final completion or publication approval is
claimed. Machine-readable reports record their own exact counts.

| Check | Verified at this checkpoint |
|---|---|
| Exact new-query SERPs | 200/200 returned organic results, US/en desktop; five forty-query Apify runs |
| Native article contract | 99/99 pass against original lander code at `b6b0833`; 102 total records including its original three |
| Review isolation | All 99 review-only, all approvals false, no publication dates; production lookup excludes every batch record |
| Content checks | 99/99 pass; 114,500 body words; no pair exceeds the 12% eight-word-shingle containment review threshold |
| Worker regression | 2,996 tests pass, 70 files; lint/typecheck pass |
| Worker build | Pass, with existing ineffective-dynamic-import warnings |
| Native checks | 32/32 blog tests; app-update, gateway and acquisition checks pass; lint passes |
| Native preview build | Pass; 124 total routes generated, including 102 review article pages |
| Local HTTP | 99/99 return 200 with correct canonical, noindex, one H1, index and download links |
| Media HTTP | 105/105 referenced assets return 200: 99 SVGs plus three existing video/poster pairs |
| Discovery | Preview robots disallow all; sitemap and llms exclude drafts; download returns 200; unknown slug returns 404 |

## Browser sample

Desktop index: 102 cards, one H1, 1280px viewport and scroll width, no error
overlay or console errors. At 390px the frame-extraction article has no page
overflow, one H1, a responsive table, video controls, a poster, playsInline and
no autoplay. This is a sample, not a visual review of all 99 pages. Large mobile
display headlines are inherited from the existing renderer and remain a team
design-review choice. No Lighthouse score or accessibility certification claimed.

Raw source transport failures are recorded honestly; separate web-body fallback
receipts do not change those failed automatic results. Editorial approval is still
false. The 8-word comparison is not an exhaustive plagiarism or intent audit.

The later expanded HTTP check also follows body anchor destinations. Against
this partial build it correctly finds 404s for related articles still being
written (first observed: `/blog/founder-video-press-statement`). The earlier
99-page HTTP result above did not include all body-anchor destinations. Full
internal-link completion remains pending the complete 250-page build.

## Boundaries

Only this new batch folder is changed in Git. Original fifty article/media hashes
are checked on each assembly. The lander used for validation is a disposable,
remote-free clone; original lander, production, worker retry/state and schedules
remain untouched. There has been no merge, deployment, publishing or indexing
submission. This manual batch does not prove unattended autoblogger operation.
