# Dream Pilot A Release Verification

Verified: 2026-09-01 (Asia/Kuala_Lumpur)

## Release identity

- Git commit deployed: `d4e0376` (`fix: reject private analytics paths`)
- Vercel project: `videoclaw-demo-day-review`
- Deployment: `dpl_9HaT1caKJ4SRZDqgChvMQNy2fuQr`
- Immutable URL: <https://videoclaw-demo-day-review-b52bhgt2m.vercel.app>
- Stable production alias: <https://videoclaw-demo-day-review.vercel.app>
- Vercel state after deployment: `Ready`

## Automated release matrix

| Check | Command | Result |
| --- | --- | --- |
| Tests | `pnpm test` | Pass: 13 files, 73 tests |
| Lint | `pnpm lint` | Pass |
| Type generation and TypeScript | `pnpm typecheck` | Pass |
| Exact Vercel production build | `pnpm build:next` | Pass: 11 routes generated |
| Deployment inspection | `vercel inspect` | Pass: production, Ready, stable alias attached |

The suite includes both global indexing states, permanent route headers, sitemap and `llms.txt` exclusions, private-route analytics suppression, rejection of forged private-path events, source/data contracts, media contracts, and HTML/Markdown parity.

## Browser verification

| Route | HTTP/title/H1 | Primary interaction | Console | Responsive layout |
| --- | --- | --- | --- | --- |
| `/pilots/dream-demo-day` | 200; `Private Physical-AI Qualification Dossier \| VideoClaw`; source-controlled qualification H1 | Generic VideoClaw video controls and dossier navigation present | No page errors | Desktop and 390×844 mobile pass |
| `/guides/physical-ai-product-demo-before-demo-day` | 200; `Physical-AI Product Demo Preflight \| VideoClaw`; physical-AI preflight H1 | Markdown download link present; 48-hour and 14-day sequences each show three ordered milestones | No page errors | Desktop and 390×844 mobile pass |
| `/use-cases/demo-day-founder-content` | 200; existing use-case title/H1 retained | Existing private-alpha and source-pack actions present | No page errors | Pass |

Screenshots:

- `screenshots/dream-dossier-desktop.png`
- `screenshots/dream-dossier-mobile.png`
- `screenshots/physical-ai-guide-desktop.png`
- `screenshots/physical-ai-guide-mobile.png`

## Privacy and discovery verification

- The dossier, guide, and Markdown download return `X-Robots-Tag: noindex, nofollow` in production.
- Route metadata is `noindex, nofollow`; route-specific protection remains active even when the global indexing flag is exactly `true`.
- `robots.txt` currently returns `Disallow: /` because the review deployment's global public-indexing flag is not enabled.
- Neither private route appears in `sitemap.xml` or `llms.txt`.
- The root page contains no rendered `Dream`, `ROBOX`, or `Qlo` account copy.
- Dream-specific paths and private-guide destinations are excluded from analytics allowlists. Runtime events are suppressed on private pages, and forged private-path events are rejected on normal pages.
- The Dream dossier contains no customer, endorsement, product, or organization schema; no Dream media, contact data, or participation claim; and labels the generic VideoClaw video as a non-Dream illustration.

## Download verification

`/guides/physical-ai-product-demo-before-demo-day/download` returns:

- Status `200`
- `Content-Type: text/markdown; charset=utf-8`
- `Content-Disposition: attachment; filename="videoclaw-physical-ai-demo-day-preflight.md"`
- `X-Robots-Tag: noindex, nofollow`

The file includes the five-step story, source-pack and claim-control checklists, three-step 48-hour clock, three-step 14-day sequence, review prompts, approval boundary, measurement, limitations, and dated NIST/FTC sources.

## Runtime evidence

- Production browser checks loaded both new pages from the stable alias with no browser-reported page errors.
- Vercel error-level and HTTP 500 log queries for the deployment returned no matching logs after live route checks.
- Rollback remains available through the preceding production deployment if required.

## Release decision

Pass for private stakeholder review. This release does not authorize public indexing, Dream outreach, Dream-specific video generation, reuse of Dream media, or any claim that Dream is a VideoClaw customer, participant, partner, or endorser.
