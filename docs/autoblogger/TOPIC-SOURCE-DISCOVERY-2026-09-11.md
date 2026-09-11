# Topic-aware source discovery

## Correction

The previous fresh run retrieved relevant content-operation pages but rejected all of them at the authority gate. Its four supporting publisher searches were the same for every topic, including founder-oriented YC and Techstars searches. A single exact-page addition did not solve coverage when the Google results changed.

Supporting search now selects a bounded publisher profile from the original keyword. Explicit content/video repurposing and content-operation queries use Buffer `/resources/`, Optimizely `/optimization-glossary/`, TechSmith `/blog/`, and Descript `/blog/article/`. Other topics retain the founder/video profile. Titles and provisional FAQ wording cannot change the profile. Substantive query qualifiers remain intact; this does not replace the exact US/en keyword SERP or establish search volume.

The new editorial scopes provide first-party practitioner guidance, not independent proof of market outcomes, competitor superiority, or VideoClaw capabilities. [Buffer's guide](https://buffer.com/resources/repurposing-content-guide/) explains channel adaptation and its own content practices. [Optimizely's glossary](https://www.optimizely.com/optimization-glossary/content-repurposing) describes content selection and editorial workflows. Their promotional outcome claims are not automatically endorsed. The existing body admission, exact-anchor, claim critique and source-use checks still apply.

## Boundaries

- Four publisher queries plus at most three observed FAQ queries, one supporting batch and at most 24 body fetches: unchanged.
- Editorial path and hostname scope required; lookalike hosts, unrelated paths and out-of-scope redirects do not inherit authority.
- Both prefix and exact-page policies reject non-default ports.
- At least two relevant usable bodies, one approved primary/authoritative source and three distinct body-supported observed FAQs remain required.
- No retries reset, evidence injected, article manually rewritten, production changes, lander PR, publishing or schedule activation.

## Verification so far

The new regression suite produced 13 expected failures before the routing/catalog correction. Two remaining failures then reproduced non-default-port inheritance before its correction. The complete suite passed **2,732 tests across 61 files**, with zero failed/pending tests; lint, typecheck and build passed. Existing Vinext dependency bundling warnings remain.

The real source reader fetched the two linked pages with HTTP 200, 11 retained body passages each and scoped authority recognition. This is a live body-reader component check, **not** completed article or uninterrupted worker proof. Private receipts: `artifacts/autoblogger/topic-source-body-check-2026-09-11` and `artifacts/autoblogger/topic-source-suite-2026-09-11.json`.

Persistent failed-run history is unchanged at this checkpoint: 31 runs / 53 failure records, no active pilot. Systematic debugging identified the retrieval-policy mismatch; test-driven development reproduced it before changes, and verification distinguishes component results from the still-open end-to-end milestone.
