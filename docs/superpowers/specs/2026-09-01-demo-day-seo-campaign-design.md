# VideoClaw Demo Day SEO/AEO/GEO Campaign Design

## Outcome

Build the first usable US campaign experience for VideoClaw around one narrow situation: an accelerator founder whose Demo Day, launch, or showcase is 7–21 days away and who needs an approved founder story to keep working after the event.

The campaign adds two static, answer-first routes to the existing private prototype:

- `/use-cases/demo-day-founder-content` — the commercial use-case page.
- `/guides/founder-story-after-demo-day` — the education-first guide targeting the primary search job.

Both routes lead to the existing eight-point source-pack diagnostic and the verified private-alpha Mac access URL, `https://videoclaw.com/alpha/download`.

## Audience and intent

The primary customer is a US accelerator founder with an approved or nearly approved pitch, a real product or honestly labeled prototype, at least one cleared proof point, one final approver, and a deadline inside 21 days.

The guide targets `demo day video checklist for startup founders`. Supporting jobs cover backup demo video preparation, a 90-second founder/product/proof structure, product-demo recording hygiene, investor proof, format selection, and video-supported investor follow-up.

The use-case page answers the commercial question: how can one approved story and one product-proof sequence support investor, customer, and recruiting follow-up without changing the underlying facts?

## Content architecture

### Use-case route

The page opens with a direct answer, deadline qualification, private-alpha disclosure, one local proof video, and two actions: request private-alpha Mac access or run the source-pack check. It then explains the controlled proof system, displays investor, customer, and recruiting variants, states the pilot measurement protocol, answers visible FAQs, and closes with the same two actions.

The page must not promise delivery time, output quality, cost, access, integrations, fundraising outcomes, customer outcomes, privacy controls, or automated asset ingestion. Illustrative videos are labeled as campaign prototypes, not customer work or performance proof.

### Guide route

The guide opens with a two-sentence answer and a crawlable checklist. It distinguishes application video, product demo, Demo Day pitch, and follow-up video; provides an eight-input source-pack checklist; gives a 72-hour preflight; explains a 90-second founder → product → approved evidence structure; and outlines a 14-day follow-up sequence. The guide includes six concise, visible FAQs and contextual links to the use-case page, source-pack check, and private-alpha access flow.

## Media

Use only the already generated and verified local Demo Day campaign videos. Copy the 16:9 base, investor, customer, and recruiting sound versions into `public/media/demo-day/`. Generate static poster frames from those local files.

Every video uses native controls, `playsInline`, metadata preload, a visible descriptive caption, and an accessible label. Autoplay is not used. The first video may preload metadata; supporting variants use `preload="none"`. Video completion is counted once from the native `ended` event; seeking near the end does not count.

## Shared interfaces

`app/campaign-content.ts` owns campaign URLs, FAQ data, schema constructors, indexing policy, and the analytics event formatter. It exposes deterministic, side-effect-free functions that are covered by tests.

`app/campaign-event-tracker.tsx` is the only new client-wide analytics listener. It emits `videoclaw:analytics` browser events and mirrors them to `window.dataLayer` when present. It sends no network request, stores no user identifier, sets no cookie, and keeps no durable browser storage.

`app/campaign-video.tsx` is the reusable client video component. It records play and 90%-complete events while leaving playback under user control.

## Measurement contract

Required event names are:

- `page_view`
- `video_play`
- `video_complete`
- `article_click`
- `source_pack_complete`
- `alpha_download_click`

Each event includes `event`, `page_path`, and `timestamp`. Link events may include a same-site `href`; video events require `video_id`. Query strings, fragments, external destinations, and personal data are removed before dispatch.

## SEO, AEO, GEO, and structured data

Each route exports its own title, description, canonical, Open Graph data, and robots policy. The preview remains `noindex, nofollow`. Public indexing becomes possible only when `NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING=true` is deliberately set for a production build.

The use-case page emits `WebPage`, `BreadcrumbList`, `FAQPage`, and truthful `VideoObject` nodes. The guide emits `Article`, `BreadcrumbList`, and `FAQPage`. Structured answers exactly match visible content. Do not add `Product`, `Offer`, `Review`, `AggregateRating`, or outcome claims.

Add `robots.ts`, `sitemap.ts`, and `public/llms.txt`. The sitemap contains only the two campaign routes and is empty while public indexing is disabled. Production canonicals point to `https://videoclaw.com`, even on a private preview.

## Visual system and accessibility

Extend the prototype’s editorial black, warm-paper, and acid-green system. New rules are namespaced under `.campaign-page` or `.guide-page`; broad existing selectors are not rewritten. Use semantic landmarks, one H1 per route, visible focus states, keyboard-operable details and links, no color-only status, responsive grids, captions, and reduced-motion behavior.

## Private-preview safeguards

The deployment is a review build, not a public campaign launch. It must show `PRIVATE CAMPAIGN PREVIEW · NOINDEX`, keep all pages noindex/nofollow by default, contain no submission form for confidential material, and state that the source-pack check is a local readiness diagnostic rather than an upload or generation request.

## Acceptance criteria

- Both exact routes return 200 and render static HTML.
- Each route has a unique title, description, canonical, one H1, visible direct-answer copy, and matching JSON-LD.
- All private preview pages resolve to noindex/nofollow without the explicit production flag.
- The alpha-access CTA always uses `https://videoclaw.com/alpha/download`.
- Four local 16:9 campaign videos and their poster images load without external media requests.
- Analytics events are observable through `videoclaw:analytics` and optional `dataLayer` without a network call.
- The source-pack diagnostic emits start, completion, and copy events.
- Tests, lint, and the production build pass.
- The private preview is deployed and its two campaign routes respond successfully.
