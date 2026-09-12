# Final local QA — 250 review articles

Verified September 12, 2026. **250 complete Markdown review drafts, exactly 50 per ICP**: the original 50 retained byte-for-byte plus 200 additions. This supersedes earlier partial checkpoints. Nothing is published.

| Check | Final result |
| --- | --- |
| Campaign counts | Newly funded 50; Demo Day 50; production comparison 50; GTM repurposing 50; portfolio platform 50 |
| Content | 250 pass; 283,028 body words; unique IDs, slugs, titles, primary keywords, article hashes and graphic hashes |
| Repetition screen | No pair crosses 12% eight-word-shingle containment; not an exhaustive plagiarism or semantic-intent guarantee |
| Search evidence | All 200 additional exact queries have US/en desktop organic observations with Apify run/dataset provenance |
| Native contract | 250/250 pass against unchanged lander code at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3` |
| Review isolation | All review-only, approval flags false, no publication dates; every batch record excluded from production lookup |
| Native total | 253 records: this batch plus the original three; zero published |
| Worker checks | 3,002 tests across 70 files, including 14 manual-batch helper cases; lint, typecheck and build pass |
| Native regression | 32 blog tests; 16 app-update checks; 10 gateway checks; acquisition contract and lint pass |
| Native build | Unchanged preview build passes: 275 total routes, 253 article pages; static generation 3.1 minutes |
| Build identity | Every copied Markdown/SVG hash matches inventory; every batch route is in the prerender manifest |
| Article HTTP | 250/250 return 200 with canonicals, noindex, one H1, index discovery and download links |
| Media and links | All 256 referenced media assets and 256 unique internal anchor destinations return 200 |
| Discovery | Preview robots disallow all; sitemap and llms exclude drafts; unknown article 404; download 200 |

Proof: [content audit](content-audit.json), [native contract](native-contract-report.json), [build identity](build-audit.json), [HTTP audit](http-audit.json), [verification summary](verification-summary.json).

## Browser sample

The index has 253 cards, one H1 and no overflow at 1280px. Five representative articles, one per ICP, were checked at 1280px and 390px. All had one H1, no page overflow, loaded graphics, posters, video controls, playsInline and no autoplay. Mobile videos fit at 338px; wide tables stay inside 342px horizontally scrollable containers.

Samples: `startup-lost-deal-messaging-interviews`, `prototype-display-flicker-investor-demo`, `unlimited-video-editing-queue-capacity`, `nurture-sequence-from-existing-content`, and `portfolio-media-library-tag-taxonomy`.

All three reused videos played briefly with audio muted for the test: playback advanced without media errors, then was paused and unmuted. Durations: 48.149, 77.525 and 50.067 seconds. Tab focus was visible with a 3px outline. No browser page errors or console messages appeared during the sample. This is not a visual review of all 250 pages or an auditory QA pass.

Inspected screenshots: [desktop index](qa-assets/desktop-index.png), [mobile article/focus](qa-assets/mobile-article.png), [mobile table](qa-assets/mobile-table.png). Large display headlines and horizontal table scrolling are inherited design choices. No Lighthouse score or accessibility certification is claimed.

## Evidence and editorial limits

Independent full-pair reviews cover ten new articles per ICP (50), plus four supplemental Demo Day articles. Specific corrections are recorded in [resolutions](reviews/resolutions.md). Non-blocking provenance/example refinements remain in the [supplemental review](reviews/demo-day-last-four.md). Narrow source checks do not substitute for reviewing every article end to end. No editorial approval is implied.

Transport audit: 288 historical URLs, 172 body retrievals and 116 automatic failures. The final 200 articles cite 286 distinct URLs; 115 had an automatic failure. Separate web-body receipts and review reports record fallback reading without relabeling those failures. Google/Zoom locale/title-routing caveats remain noted. Two historical URLs are no longer cited.

Of 750 FAQs, 36 exactly match observed PAA and 714 are explicitly editorial. All volume, difficulty and CPC fields remain provider-pending. Organic results establish a search landscape, not demand. Competitor gaps and intent classifications remain editorial assessments where ranking-page bodies were not inspected.

## Build lesson and boundaries

The initial overlapping native-validation/build attempt hit 60-second generation timeouts and was stopped. Running validation first, then the unchanged build, passed without timeout errors. The library reparses the collection on each lookup; do not overlap these CPU-heavy checks. No timeout, renderer, schema or publication gate was loosened.

Only this new batch folder changes in Git. The original fifty article/media hashes are unchanged. Validation uses a remote-free disposable clone. Original lander/PR #55, production branches, worker runtime/retry state and schedules remain untouched. No merge, deployment, publishing, indexing submission or generated lander PR occurred. This manual batch does not prove unattended autoblogger operation. Team approval and paid demand prioritization remain separate release work.
