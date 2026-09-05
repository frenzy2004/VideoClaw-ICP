# Research recovery checkpoint — 6 September 2026 (MYT)

## Outcome

**The worker repairs and research audit progressed; the one-article pilot did not succeed.** No new article, native generated-article validation, preview page or generated lander PR was produced. No production, lander source, schedule or publication state was changed.

This follow-up was a bounded diagnostic/research pass, not a second successful pilot. The existing local pilot state and exhausted-attempt history were retained unchanged; `manualPilot` is still `null`. Do not reset that history to manufacture a success.

## What the failed checks actually meant

The preceding run's ten rejected candidates were examined using their exact retained Apify dataset. Eight failed the source-selection gate; two reached source selection but lacked three relevant PAA questions.

Rechecking the 80 distinct source URLs produced:

| Outcome | URLs |
| --- | ---: |
| HTTP 200 / reachable | 48 |
| HTTP 403 | 22 |
| HTTP 404 | 1 |
| Response exceeded the existing byte limit | 7 |
| HTTP rather than required HTTPS | 1 |
| Timeout | 1 |

Reachability is not article-body verification. A social URL redirected to an unsupported-browser page can return 200 without supplying useful evidence. The authority allowlist also excluded some relevant primary publishers: for example, IVP's fundraising-announcement PDF was reachable but not allowlisted. No authority domains or source limits were changed here.

There was genuine intent drift as well. `post funding customer proof claims review` returned consumer-finance complaints and proof-of-funds material; its government sources do not make it a useful VideoClaw topic. Several other queries produced generic startup-failure questions. They must not be reported as validated article opportunities.

## Cross-ICP discovery and collection quality

Fifteen plain-language seeds (three per ICP) produced autocomplete observations. Thirty-three queries were then selected for a fresh US/en desktop first-page scan, using observed suggestion text where useful. Variants were research probes, not separate approved articles.

| Campaign | Queries checked | Examples | Interpretation |
| --- | ---: | --- | --- |
| Newly funded founder | 8 | funding announcement video; founder story examples | Search language observed; article eligibility not established |
| Accelerator / Demo Day founder | 9 | yc application video; demo day presentation | Search language observed; organic/PAA collection insufficient |
| Production comparison | 6 | video editing cost per hour; in house video production | Search language observed; no passing three-question FAQ set |
| GTM / repurposing buyer | 7 | video repurposing tool; repurpose webinar content | Search language observed; no qualifying evidence bundle |
| Portfolio / accelerator platform | 3 | accelerator marketing; portfolio company marketing | Ambiguous or missing useful exact suggestions; no quota forced |

Of these 33 observations, **7 contained organic results, 26 did not, and 4 contained any PAA questions. None passed the unchanged three-relevant-PAA selector.** Some empty organic records contained an AI answer. AI answer text was not promoted into organic results, source facts or PAA evidence.

The same collector was checked with three explicit Google US/en URLs. An alternative Apify collector was checked on four queries. A final three-query check used broader Demo Day terms. All ten diagnostic observations lacked organic/PAA results. Total: 36 distinct query probes, 43 SERP observations including repeats, and zero qualifying new bundles.

This establishes **insufficient collection evidence**, not zero search demand or a confirmed Google/Apify outage. For example, YC's [own application-video page](https://www.ycombinator.com/video/) is discoverable through a separate web search, despite the empty Apify observation. Missing paid metrics are not the blocker for the authorized Apify-only pilot.

## Worker repairs

1. **Balanced queue:** eligible candidates round-robin across campaigns after duplicate, state and lease filtering. Five full campaigns receive ten slots each in a 50-candidate scan; exhausted campaigns release unused slots. Within-campaign ordering and the complete queue/tail are preserved.
2. **Evidence-aware deep shortlist:** known missing organic/suggestion/relevant-PAA/product-fit requirements are screened before spending the ten deep-inspection slots. Scheduled mode also rejects pending paid metrics before deep checks; research and the authorized manual pilot retain their existing pending-metrics exception. Insufficient collection remains a bounded retryable failure, not permanent proof of a bad topic; product irrelevance remains non-retryable.
3. **Responses schema compatibility:** removed unsupported conditional composition from the provider-facing critique schemas. Runtime Zod approval/issue consistency, binding coverage, independent critique and one-repair limits remain enforced. OpenAI explicitly lists these composition keywords as unsupported. [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs#some-type-specific-keywords-are-not-yet-supported)

All three actual worker JSON schemas received HTTP 200 from the configured `gpt-5.5` Responses API. These were synthetic 32-output-token acceptance probes: all intentionally ended `incomplete`. They verify schema acceptance, **not** a successful generation, critique or approved article. Combined usage: 687 input tokens and 96 output tokens. No secret or generated response text was retained in Git.

## Exact Apify provenance

All times are UTC on 5 September, after midnight on 6 September MYT. All five jobs were subsequently confirmed `SUCCEEDED`; successful actor execution does not imply useful evidence.

| Purpose | Actor | Run | Dataset |
| --- | --- | --- | --- |
| 15 autocomplete seeds | automation-lab/google-autocomplete-scraper | `odUBp4AxePjmsk0g1` | `V0VqSIjMc9GD0CeUy` |
| 33-query shortlist | apify/google-search-scraper | `plU7aQA37u799uF8d` | `i9LZdLnSTxbI0UrFE` |
| 3 explicit URL checks | apify/google-search-scraper | `klI8tDsmvNKUxY1DU` | `MOZlMTIG7cHsID7Jy` |
| 4-query collector cross-check | scraper-engine/google-search-results-scraper | `nBen3VOiK1CMLwVS0` | `RF48vRDFx4l4evcyl` |
| 3 broader Demo Day probes | apify/google-search-scraper | `kkVJgEaF7DJlKo9zw` | `Zlwyd9PoRi0wjDIQw` |

The API-reported run usage totals about **$0.13** for this follow-up. This is not a final bill and excludes OpenAI. Raw SERP data stays in Apify and ignored local diagnostic artifacts; it is not committed.

## What remains before the article preview

Verification of the repairs: **615/615 tests across 44 files**, lint, typecheck, build and whitespace checks passed. Independent review also caught and verified a fix ensuring product-irrelevant candidates are rejected before any metrics call, even during provider failure. The successful end-to-end tests use offline fixtures; no live generated-article/native-build result is implied. See the [verification record](VERIFICATION.md).

1. Establish a reliable organic-result/PAA collection path and compare a small known-query sample against visible Google results. Do not keep buying empty batches or silently substitute AI answers.
2. Select one distinct intent outside the three existing lander posts, verify source body facts and three genuinely relevant observed questions, then run generation, independent critique and native lander validation.
3. Only after that passes, expose the Markdown/SVG/report and a local preview. Human publication approval remains separate.

Local diagnostics are in ignored `artifacts/autoblogger/pilot-recovery-2026-09-06/`. Prior state remains in `artifacts/autoblogger/local-pilot-2026-09-06/state.json`. Neither is Git-backed. Retain/reconcile that history before moving to Actions. OpenAI and Apify access work locally; unattended read credentials and Actions OpenAI setup remain later dependencies, not reasons to claim this article is complete.
