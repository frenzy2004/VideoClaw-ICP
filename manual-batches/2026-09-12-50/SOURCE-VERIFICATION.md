# Source verification for the manual batch

Checked September 12, 2026. The 50 article records cite 64 distinct source URLs.
Authors opened the supporting pages and recorded specific support notes in each
article's private `editorial-notes` record. Sources appear beside factual claims
and in the rendered article's source list.

## Automatic retrieval is not the same as editorial verification

`source-audit.json` preserves the independent worker-reader results: 41 source
bodies retrieved; 23 unavailable through that reader. Its size limits, UTF-8
decoder, extraction requirements, network errors and PDF handling caused those
failures. They have **not** been overwritten as automatic passes.

The main reviewer separately retrieved readable content for the following
automatic failures through the web-reading tool:

- Adobe: Text-Based Editing overview; Consolidate and archive projects.
- UCSF: Video standards.
- Microsoft: Writing step-by-step instructions.
- Mailchimp: Video content blocks in the legacy builder.
- NIST: Generative AI Profile, NIST AI 600-1 (PDF).
- Oral History Association: Oral history best practices.
- Sequoia: Writing a business plan.
- Google Analytics: Campaign URL parameters; About key events.
- YouTube: Creating Shorts from existing videos; Resolution and aspect ratios;
  Audience retention.
- Apple: Mail Privacy Protection.
- BLS: Employer Costs for Employee Compensation release.
- FTC: Advertising FAQs; Endorsement Guides questions; Start with Security.
- Upwork: Video editor costs.
- Wenger-Trayner: Introduction to communities of practice.
- YC: What happens at YC; The application video.

The remaining YouTube scheduling page (`answer/1270709?hl=en`) failed direct
opening in that tool too. Its complete English instruction text was available
through the official-page search result, cached September 11, 2026. It supports
the date/time/time-zone scheduling statement in the calendar article. This is
cached-text verification, **not a fresh origin HTTP-200 receipt**.

Exact URLs and automatic outcomes remain in `source-audit.json`; the source's
specific supported claim is in the article's `editorial-notes` file. Reachability
and editorial checks are bounded observations, not guarantees of future access,
legal approval, or automated source-verification reliability. These drafts are
not an unattended worker success and remain under review.
