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

## Subsequent fresh worker attempts — not successful

The patch was independently reviewed with no P1/P2 findings and committed as `eac3414`. Two unchanged, previously unattempted backlog records were then run through the real local artifact-only worker. Both fresh lander inventories verified review SHA `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; publication remained disabled. Neither attempt used saved source facts or manually rewritten article content.

1. `repurposing-roles-live-proof-2026-09-11`, candidate `vc-c4-042`: started September 11 at 14:02:20 UTC. The Google collector run `NlzGAAMaiR9VpSBPg` ended `TIMED-OUT` at its configured 120-second limit, with no extracted results. Its log records a failed Google `goto` redirect resolution. Run metadata reports dataset `lqaoWd0YWLJ4tdxc8`, status message “Nothing extracted yet”, and a reported actor charge of $0.001 (not a total-account cost claim). This is a collector failure before source inspection, not a test of the new source-selection behavior.
2. `repurposing-intake-live-proof-2026-09-11`, candidate `vc-c4-043`: started at 14:07:13 UTC and failed at 14:07:56 on an Apify HTTP request exceeding the existing 10,000 ms request limit. The error alone does not prove a platform-wide outage or identify its precise remote cause.

Read-only reconciliation found that the second attempt's autocomplete actor `EpmseHK9WewKoX7AU` actually reached `SUCCEEDED` remotely at 14:07:54, dataset `8D11wLP9BH0wFnUS1`. No Google SERP actor start appeared in that attempt's time window. The worker still failed and did not consume those observations. Remote actor success is not worker success: transport/polling reliability remains an integration problem to investigate, not evidence that more credentials or relaxed content gates are needed.

Both attempts failed shallow research before any OpenAI request, article draft or native lander QA. No uninterrupted article-to-native-QA success is claimed. No additional paid attempts were launched after the second failure; timeouts, retry limits, failed records and publication gates were not weakened to obtain a passing result.

Latest state is **33 runs / 55 failure records**, no active pilot; SHA-256 `9bba46f8ae5a593d8bb294a0a1a8817effac2cbcc42c861102bb4360b8713dca`. Private failure and execution-audit receipts are under the two run directories in `artifacts/autoblogger/`. The next live proof needs successful fresh collection; no new credentials were requested, and production, the original lander checkout, PR #55 and scheduling remain untouched.

## Observation-read recovery follow-up

The same three API read attempts now have bounded backoff (5 then 10 seconds at default settings), instead of immediate re-requests. Delays consume the existing 150-second total execution deadline. Actor creation still occurs once; the 120-second server run limit, read-attempt count, polling count and candidate-attempt history remain unchanged. Failures identify the observed run ID and the failing stage, with redaction applied to the complete message. Dataset retrieval failure never aborts a job already observed as successful.

Four initial tests failed before the change. The recovery fixture models a 40-second observation outage and proves that delayed reads can recover the same job within three requests; it does not establish the exact cause of the historical timeout. A fifth test confirms that backoff cannot extend the original deadline or trigger a late additional read. Independent review found no P1/P2 issues. **2,737 tests across 62 files**, lint, typecheck and build pass; existing dependency bundling warnings remain.

Six read-only requests to completed job `EpmseHK9WewKoX7AU` succeeded: three through the worker HTTP client (78–156 ms) and three through direct fetch (43–142 ms). No new actor was started by this diagnostic; it demonstrates current API availability, not new article proof. Receipts are private under `artifacts/autoblogger/apify-observation-read-check-2026-09-11` and `artifacts/autoblogger/read-backoff-suite-2026-09-11.json`. Persistent state remained unchanged at 33 runs / 55 failures during the correction and diagnostic.
