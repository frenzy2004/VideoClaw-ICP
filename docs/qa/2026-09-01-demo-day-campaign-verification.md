# Demo Day campaign private-release verification

## Release identity

- Verified source commit: `d40ac71849c78eda1f21b877dc89c4cd86b076fc`
- Private URL: `https://videoclaw-demo-day-private-review.frenzyman.chatgpt.site`
- Saved Sites version: 2
- Deployment status: succeeded
- Node: `v24.18.0`
- pnpm: `11.19.0`
- Lockfile SHA-256: `68147281162d020c6ca605d6b23e4094bf5bfcb9d3a04faf7eb57efaa4e2b6a5`
- Packaged build SHA-256: `450c775f90285bb982bd905de574150d667f96e0dacebc52b6f1d2d9fc3cb597`
- Packaged entries: 119

## Automated gates

- `pnpm test`: 9 files, 49 tests passed, 0 failed.
- `pnpm lint`: passed with no lint errors.
- `pnpm typecheck`: Next route types regenerated; non-incremental TypeScript check passed.
- `pnpm build:next`: passed; root, use case, guide, robots, and sitemap built successfully. The two campaign pages are statically prerendered; `llms.txt` is served dynamically from the publication gate.
- `pnpm build:sites`: passed and produced `dist/server/index.js`, `dist/client`, and matching `dist/.openai/hosting.json`. Vinext emitted its known `INEFFECTIVE_DYNAMIC_IMPORT` warnings; no application build error occurred.
- `git diff --check`: passed before both release commits.

## Content and behavior gates

- Exact routes exist:
  - `/use-cases/demo-day-founder-content`
  - `/guides/founder-story-after-demo-day`
- Exact access destination is `https://videoclaw.com/alpha/download` throughout.
- Use-case scope is US accelerator founders with a Demo Day, launch, or showcase 7–21 days away.
- Investor, customer, future-hire, and partner/media viewer jobs are distinct.
- Four local 45-second MP4s include sound, posters, six-cue VTT captions, and visible transcripts in exact cue-text parity.
- Prototype labels do not imply customer work, performance evidence, or promised VideoClaw output.
- Source-pack diagnostic is local-only and states that nothing is uploaded, transmitted, stored, reviewed, or generated.
- Analytics uses only approved campaign routes, destinations, IDs, timestamps, and event-specific contexts. GPC and DNT suppress owned event emission; hostile direct events are rejected before `dataLayer`.
- Skip links, page-level banner/main/content-info hierarchy, visible checkbox focus, persistent mobile navigation, and the focusable horizontal table region are present.

## Private indexing gates

Local Next and Sites runtime checks returned `200` for the root, both campaign routes, `robots.txt`, `sitemap.xml`, and `llms.txt`.

- HTML includes `noindex, nofollow`.
- Responses include `X-Robots-Tag: noindex, nofollow`.
- Private HTML contains no canonical and no public JSON-LD.
- Both campaign routes display the private-preview/noindex ribbon.
- Private `robots.txt` disallows `/`.
- Private sitemap is empty.
- Private `llms.txt` omits both campaign URLs.

Public-output checks were also run locally with the exact publication flag. The approved routes then switch coherently to public ribbons, canonicals, allowlisted schema, sitemap entries, and public `llms.txt` output. The production flag is not configured on the private Sites project.

## Deployment access and health

The deployed Site is owner-only:

- Current role: owner.
- Access mode: custom.
- Allowed account users: 1.
- Workspace groups: 0.
- Tenant groups: 0.
- External visitors: 0.

Unauthenticated requests to the root, both campaign routes, discovery files, MP4, and VTT returned `401`, confirming that campaign content and media are not publicly retrievable. Recent error-only worker logs returned zero events after deployment checks.

The authenticated owner-view smoke test requires an interactive ChatGPT sign-in and was not bypassed. The exact release artifact was verified locally instead. The local Vinext Node preview reports MP4 and VTT files as `application/octet-stream` and does not implement byte ranges; the Cloudflare asset layer used by the deployed Site may differ. Confirm deployed MIME, byte ranges, playback, sound, and captions after signing in before using this private review as a media-browser acceptance environment.

## Recovery

Version 1 remains available as the previous private saved version. If version 2 shows a regression after owner sign-in, redeploy version 1 with the private deployment operation, then investigate against version 2 without changing access or enabling public indexing. This recovery path is documented but was not exercised.

## Release decision

Version 2 is approved as an owner-only editorial and campaign review build. It is not approved for public indexing or production-domain promotion. Owner-authenticated media/browser acceptance remains the final manual review step before anyone treats the deployment as a browser-level media release.
