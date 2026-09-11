# Assisted article review — 6 September 2026

## Outcome and scope

One real GPT-5.5 draft has been editorially revised into a local review article: **Demo Day Video Checklist: Plan, Record and Rehearse**. This is an assisted artifact, **not a successful unattended pilot**. The failed model/repair result is preserved; no approval flag or pilot-success state was changed to make the article pass.

- Candidate: `vc-c2-001`, accelerator / Demo Day founder campaign.
- Primary keyword: `demo day video checklist`.
- Local URL: `http://127.0.0.1:3002/blog/demo-day-video-checklist` (available only on the operator's computer).
- Canonical destination, not a claim of publication: `https://videoclaw.com/blog/demo-day-video-checklist`.
- Status: `review`; copy, factual, legal and visual approvals all `false`; no `publishedAt`.
- Volume, difficulty and CPC: `provider-pending`, not estimated from search results.
- Original lander checkout and PR #55 remain unchanged at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.

The separate local checkout `work/videoclaw-autoblogger-preview-20260906` contains the original three review guides plus this artifact. It is not a production repository, a new hosted deployment, or a generated lander PR.

## Evidence: keep the collection methods separate

| Evidence | Observation | Limitation |
| --- | --- | --- |
| Apify organic results | Run `8xziiqYErGerN2fq0`, dataset `dnnNbzJAsZ04zThAj`, captured `2026-09-05T18:12:35.944Z`; 8 organic results for the exact US/en query | This actor response contained **zero PAA questions** |
| Browser People Also Ask | The same query requested `gl=us&hl=en`; three relevant visible questions were manually selected | Personalized result, Cambridge MA IP-derived location; not an Apify PAA result, an unbiased national sample, or an unattended selector pass |
| Source bodies | Four pages manually read; all four returned HTTP 200 during this review | Reachability alone is not claim support; the manually checked body facts are distinct from SERP snippets |
| Competitor gap | Qualitative opportunity for a founder-owned preparation, approval and handoff checklist | No measured demand, ranking guarantee, or claim that every competitor omits this angle |

Two diagnostic collector runs also completed: `Hh5fBzhCOVlJOJ2ml` / `ITlfYLaFhcvicdcYp` and `8wAcgdSncqn2YRWO5` / `DM1TeKzMSzoc9g9yu`. Neither supplied PAA. Some alternate-actor URLs were malformed and were not used as citations. Empty collector fields are not evidence that people never ask these questions.

The manually observed FAQ questions are:

1. What are the biggest demo mistakes?
2. How to record a video demo?
3. How does yc demo day work?

Source references:

- [Y Combinator: A Guide to Demo Day Presentations](https://www.ycombinator.com/blog/guide-to-demo-day-pitches/)
- [Vidyard: The Video Pre-Production Checklist for Content Creators](https://www.vidyard.com/blog/video-pre-production-checklist/)
- [Demio: How to Prepare a Product Demo](https://www.demio.com/blog/product-demo-checklist)
- [Y Combinator: What Happens at YC](https://www.ycombinator.com/about)

Vidyard appeared in the selected organic snapshot. The other three are editorial references; they are not claimed to have ranked in that snapshot.

## Actual model run and editorial intervention

Run `assisted-pilot-2026-09-06-v2` made four successful HTTP requests to the exact configured model, `gpt-5.5`: generation, independent critique, one repair, and repaired-draft verification. All four responses completed; total reported token usage was 81,685, including reasoning output. No fallback model or fifth repair call was used.

The complete repaired draft still failed:

- The verification rejected an unsupported heading about attention arriving before Demo Day.
- The deterministic product-claim guard treated ordinary uses of “it” and “the product” as unbound VideoClaw claims. All 79 sentence spans had matching bindings, but 16 triggered the product-alias predicate.

That failure remains in local state. The subsequent operator revision removed unsupported causal/timing language, clarified ordinary referents, added nine checklist items and explicit owner/deadline/reviewer/completion-evidence fields, and scoped YC's 2016 advice correctly: rehearsal recordings do not imply permission to play a video during the live pitch. Current organizer instructions take precedence.

The article's body and direct answer contain approximately 1,238 words before FAQs. Its media uses the existing 1280×720 founder-product video and poster, plus a deterministic 1200×675 editorial SVG. The video example is separate from the preparation checklist, not a claim that VideoClaw automates every checklist step. Related-guide links are rendered by the existing lander template.

Independent editorial review found no factual blocker to local preview. That review does **not** constitute team approval or an automated critique pass.

## Verification and retained artifacts

The real generated/revised bundle is passed to `Publisher.validateBundle` without a GitHub mutation backend. Validation uses a disposable clone of the exact lander review branch and runs the lander's unmodified install, 32 blog-contract tests, lint, full Next.js build, workspace-integrity check and cleanup. Browser QA additionally inspects the local renderer; fixture tests alone cannot detect duplicated sections or clipped graphic text.

Browser QA caught two worker integration defects: a duplicate Sources section, and overlapping/truncated labels in the original six-column graphic. Both are corrected: the lander's frontmatter consumer owns Sources rendering, and the SVG uses a wrapped three-column/two-row paper/ink/mint/magenta layout. Independent review additionally found an oversized Unicode grapheme overflow; three reproduced failing tests now pass with explicit rejection before rendering. Final verification records the corrected artifact, not the earlier passing-but-visually-defective bundle.

### Final verification

- Worker: **668 tests passed across 45 files**, including the offline end-to-end/native-contract fixture; lint, typecheck and build passed. Existing gray-matter direct-eval and vinext import warnings remain.
- Actual review bundle: native install, **32/32 lander blog tests**, lint, full Next.js build, workspace-integrity check and disposable-checkout cleanup passed.
- SHA-256 bundle hash: `a7f47aef4bfd025cf84e6020da1251c8cadf75f2437a99db0325e5ac569b238e`.
- A separate local build with `VERCEL_ENV=preview` successfully prerendered all four article routes, including the new checklist. This was a local build, not a Vercel deployment.
- Local HTTP checks: blog index, four guides, download form, robots, sitemap, llms text and three media assets returned 200; an unknown slug returned 404. The duplicate-Sources assertion was first reproduced failing (`2 !== 1`), then passed after regeneration.
- Browser at 1280px and 390px: no page-width overflow; one Sources section, three FAQs, nine static checklist boxes, loaded poster/SVG and working video play/pause controls; no captured console errors. The video has controls/playsInline and no autoplay. Keyboard focus is visible. Existing-guide tables and the editorial graphic scroll inside their own containers on mobile.
- The existing `/download` CTA opens the private-alpha form; no form was submitted. Related-guide links and the blog index resolve locally.
- Review metadata remains `noindex, nofollow`, with the intended `videoclaw.com` canonical. Preview sitemap/llms output excludes the article. Native checks against the actual four-record library confirm no review article is discoverable in production, and a production sitemap contains only its two shell URLs.
- No live published Article/FAQ schema or Lighthouse score is claimed: review pages intentionally omit publication JSON-LD and are non-indexable. Native schema/metadata behavior is covered by the lander's tests; production verification remains outside this work.
- Independent editorial review and cross-review of the worker changes found no unresolved important issue in this patch after the Unicode fix. These checks do not establish unattended research reliability.

All raw responses, source facts, local state and article artifacts remain under ignored `artifacts/autoblogger/`. Nothing containing API keys or full model responses is added to Git. Review outputs are under:

```text
artifacts/autoblogger/pilot-completion-2026-09-06/
  assisted-v2/                         # Actual failed four-call run and audit
  editorial-revision/                  # Explicit operator edits and bindings
  review-bundle/                       # Review bundle, never publication authority
  article/content/articles/demo-day-video-checklist.md
  article/public/media/blog/demo-day-video-checklist.svg
  article/assisted-provenance/          # Browser/manual origins travel with the article
```

The article and SVG are local review artifacts, not committed production content. Earlier pilot failures and retry history are retained. The single successful-pilot slot is not consumed by relabelling this assisted work as an autonomous success; its state and this artifact must be reconciled before any future pilot.

## Still required for unattended operation

1. Reliable automated organic/PAA collection and body-supported evidence, followed by a genuinely passing draft/critique/repair run. This is a software/evidence-quality issue, not merely missing credentials.
2. Scoped lander read access and an OpenAI Actions secret for unattended preparation. Local OpenAI access already works; interactive GitHub access is not a substitute worker credential.
3. Paid keyword-provider credentials and a validated adapter before ordinary scaling. DataForSEO is not connected; an Apify key does not supply its paid metrics.
4. Human approval of PR #1; later, merged PR #55, the least-privilege publication App, and separately approved manual draft-PR trials.
5. Explicit approval before enabling the weekly schedule. `AUTOBLOG_SCHEDULE_ENABLED` remains `false`.

There was no publication, production merge, Vercel deployment, indexing submission, generated lander PR, or schedule activation.
