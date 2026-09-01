# Dream Pilot A Site Design

**Approved:** 1 September 2026  
**Deployment:** Existing private VideoClaw Demo Day review site  
**Market:** United States

## Outcome

Add two review-only routes to the existing Campaign 2 application:

1. `/pilots/dream-demo-day` — a permanently private account dossier for qualification, source readiness, claim control, storyboard review, and production authorization.
2. `/guides/physical-ai-product-demo-before-demo-day` — a cross-company, answer-first guide for physical-AI, hardware, robotics, and computer-vision founders.

Both routes remain `noindex, nofollow` in metadata and response headers regardless of the global public-indexing environment flag. Both remain absent from the sitemap and public `llms.txt` for this release.

## Private account dossier

- Show a visible internal-planning, non-affiliation notice.
- Use only dated public facts with direct source URLs.
- Do not include Dream logos, founder images, launch-video embeds, copied screenshots, personal contacts, or generated Dream product behavior.
- Include selection rationale, exact campaign job, exclusions, qualification gate, provisional storyboard, source-pack matrix, claim ledger, prohibited implications, variant plan, query/prompt clusters, measurement record, and authorization decision.
- The existing generic VideoClaw Demo Day video may be used only with a caption stating that it is not Dream footage, a Dream product demonstration, or evidence of participation.
- Never emit customer, case-study, endorsement, product, or organization schema for Dream.

## Cross-company guide

- Begin with a 40–70 word direct answer.
- Explain the founder → physical action → software record → approved evidence → next-step structure.
- Cover rights, privacy, prototype, simulation, facility, identifier, and screen-data controls.
- Include an investor/customer variant matrix, 48-hour and 14-day activation clock, visible source-pack and claim-ledger templates, AI/human approval boundaries, measurement, limitations, dated sources, and change log.
- Offer a text/markdown download while keeping the complete useful checklist in HTML.
- Contain no Dream-specific creative or participation implication.

## Shared controls

- Store campaign facts, sources, claim states, query/prompt clusters, source-pack fields, and measurement definitions in one dedicated data module.
- Extend URL and analytics allowlists only with stable VideoClaw-owned identifiers.
- Never place company names, founder identifiers, contact data, or free text in telemetry.
- Keep existing public routes and analytics behavior backward compatible.

## Verification

- The private route and guide remain noindex when global public indexing is false and true.
- Both routes remain absent from sitemap and `llms.txt` in both states.
- Every account fact has a source URL and checked date.
- Prohibited claims cannot render as approved copy.
- Keyboard navigation, headings, links, and reduced-motion behavior remain usable.
- Lint, typecheck, tests, production build, and deployed-route smoke tests pass.
- Stable Vercel production alias serves the verified deployment.

## Authorization boundary

This approval covers the private review build and Vercel deployment only. It does not authorize Dream outreach, Dream-specific video production, reuse of Dream media, contact collection, public indexing, or any claim that Dream is a VideoClaw customer, participant, partner, or endorser.
