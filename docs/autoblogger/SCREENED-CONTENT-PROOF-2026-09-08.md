# Evidence-first live proof — content repurposing

Date: 8 September 2026, Malaysia time. Scope: worker PR #1,
`automation/persistent-autoblogger-v1`. No original lander changes, generated
lander PRs, production writes, deployments or schedule activation.

## Outcome: research passed; final content checks failed

The complete automatic research → drafting → critique/repair → native QA
milestone is **not proven**. The single authorized live attempt completed fresh
research and four model requests, but its repaired copy failed the final gate.
There is no new accepted Markdown/SVG bundle or native article QA result.

Run: `screened-content-repurposing-proof-2026-09-08`.
Execution: `2026-09-08T13:40:02.649Z`–`2026-09-08T13:45:56.271Z`.

| Stage | Actual result |
| --- | --- |
| Read-only lander/PR inventory | Passed against clean `b6b0833c78443b44b12bf6d33f05baa7ac8427d3` |
| Selected topic | `content repurposing`, GTM/content-repurposing buyer |
| Fresh US/en SERP | Nine organic results and nine observed question strings |
| Relevant FAQ gate | Three observed questions selected |
| Supporting sources | Four automatically retrieved HTTP-200 page bodies |
| Paid keyword metrics | Pending; no volume, difficulty or CPC claim |
| Draft / independent critique / one repair / verification | Four completed HTTP-200 GPT-5.5 requests |
| Final content gate | Failed: 12 product-reference binding findings and one source-use finding |
| Accepted article / native QA / generated PR | None / not reached / none |

The live worker independently recollected research. Neither the earlier screening
results nor manually supplied facts were substituted into the drafting context.
No copy, source fact, FAQ or model verdict was manually rewritten.

## Evidence-first selection

A bounded four-candidate screen ran before choosing a draft. Only `content
repurposing` had three questions that passed the existing topic-relevance gate.
`video repurposing workflow`, `video editing workflow` and `video production cost`
had organic results but insufficient relevant questions. Their rejection does
not establish zero demand; question evidence and search volume are different.

The selected candidate passed automatic source-body inspection. After the Mac
was unavailable for several hours, the search evidence was refreshed before
execution rather than treating the morning observations as current. That refresh
found eight organic results; the subsequent live run separately found nine.

Selected observed questions:

- What is content repurposing?
- What are some examples of content repurposing?
- What are the benefits of repurposing content?

## Exact live-run research provenance

These IDs belong to the actual proof run, not the earlier screens.

| Observation | Apify run | Dataset |
| --- | --- | --- |
| Autocomplete | `rmD7SaR4HKnYfcbKG` | `yShxqAGB4k38tnQZh` |
| Exact US/en organic SERP | `8eo0vPlgggJYt3Z1n` | `fU4KpMGhJzDjl0Iox` |
| PAA, one attempt | `gDWGlybfOY9YB1eMF` | `GZsMm6Tz3vK6pemRz` |
| Supporting-source searches | `duDTHpBGbmZzO8ibh` | `NYiYeO4eqfypFPk80` |

Automatically retrieved sources:

- [Descript: repurposing content](https://www.descript.com/blog/article/how-to-repurpose-content)
- [Optimizely: content repurposing](https://www.optimizely.com/optimization-glossary/content-repurposing)
- [Buffer: repurposing guide](https://buffer.com/resources/repurposing-content-guide/)
- [Typeface: content repurposing](https://www.typeface.ai/blog/content-repurposing-with-ai-5-ways-to-repurpose-content)

All four returned HTTP 200 and yielded 10–11 bounded body passages. The source
audit retains retrieval times and full body hashes locally. Raw provider data
stays in Apify; source bodies and exact model receipts remain private and ignored.

## Why the final gate rejected the article

The exact error is:

```text
Draft blocked: content_safety_failed
(content.claim_binding=12; content.source_budget=1).
```

### Product-reference checker overreach

The twelve findings are `unapproved_product_reference`, not missing bindings or
unknown fact IDs. Inspection shows the checker treating ordinary pronouns for a
named publisher, a setup/next-action step, an editorial asset, a hypothetical team
and content repurposing itself as possible VideoClaw claims. The independent
verifier approved the repair and all 97 binding reviews; all 97 hashes match.
That model approval is not proof of correctness and cannot override the final
checks, but the captured context exposes a recurring mechanical referent problem.

No new sentence-specific exception, source allowlist, review bypass or pronoun
deletion was added to force this article through. Repeated narrow grammatical
patches have not generalized to a different topic. This requires a reviewed
context-aware checker design, not another paid retry on unchanged code.

### Repair did not preserve the source-use budget

The independent reviewer classified the repaired article's source-derived spans
as follows. The deterministic ledger aggregates those classifications, including
public FAQs and metadata; it does not count contextual grounding of independently
classified original guidance as derivation.

| Source | Initial reviewed derived words | Repaired reviewed derived words | Final ceiling |
| --- | ---: | ---: | ---: |
| Descript | 166 | **199** | 180 |
| Optimizely | 158 | 94 | 180 |
| Buffer | 50 | 96 | 180 |
| Typeface | 46 | 141 | 180 |

The repair received the initial ledger, the 120-word planning target, and
whole-article repair instructions. Nevertheless, Descript-derived public copy
increased by 33 words. The verifier claimed the source issue resolved, while its
own classifications produce a 19-word overage. The numerical gate correctly
refused acceptance. Fixing the twelve reference false positives alone would not
make this saved draft pass. The 180-word ceiling has not been increased.

Hash-verified, read-only replay of the unchanged repaired response, original issue
registry and independent verdict reproduces all thirteen findings through the
same finalizer used live. It creates no bundle, changes no state and calls no API.

## Model execution and usage

Configured `gpt-5.5`; all four responses resolved to `gpt-5.5-2026-04-23`. There
was no model fallback, fifth request, second repair or interrupted request.

| Stage | Input tokens | Output tokens | Total |
| --- | ---: | ---: | ---: |
| Draft | 10,355 | 8,585 | 18,940 |
| Critique | 28,773 | 8,877 | 37,650 |
| Repair | 35,834 | 7,953 | 43,787 |
| Verification | 32,724 | 9,443 | 42,167 |
| Total | 107,686 | 34,858 | **142,544** |

Cached input was zero; 773 reasoning tokens are included in output totals.
This is observed token usage, not a dollar estimate. The volume of review payload
is another reason to fix the checking/composition design before spending again.

## Software changes and verification

The scoped changes precede the live run; drafting/checker code was unchanged:

- Added an explicitly authorized successor-topic form that names the exact
  consumed failed predecessor. It archives the old approval, decision, run and
  failures with a history hash. It cannot reset an attempt, authorize a schedule,
  create a PR, or follow an already successful proof.
- Fixed a preflight false block caused by treating attempt-zero PR #55 inventory
  rows as worker publications. Only unchanged inventory-only records qualify for
  the exception; actual attempts, hashes and publication records still block.
- Fixed preparation of a new exact candidate with a full 500-entry queue. The
  stored queue stays bounded; the selected identity remains in its approval and
  transient backlog and is reserved before paid work.
- Added failing regression tests before implementation. Independent review found
  no remaining blocking defect in this scoped diff.

Pre-run verification passed **1,800 tests across 52 files**, repository lint,
regenerated-route typecheck, build and whitespace checks. Earlier tests interrupted
by lid-closed sleep were rerun while the Mac was awake and charging; timeouts and
assertions were not loosened. Existing dependency build warnings remain.

Final post-run verification repeated the full suite: **1,800/1,800 tests across
52 files**, starting 21:55:24 Malaysia time (108.33 seconds), followed by confirmed
lint/typecheck/build and whitespace success. Changed content passed secret-pattern
and exact runtime-secret scans; documentation has no broken local links. The final
read-only report review found no inaccurate checkpoint claims.

## Retained history and boundaries

Pre-run state SHA-256:
`d4520f3785f3aa3a95f5e25eef0b987d6cdd89a87a9c1eb6415f2fcc07c57916`.

Post-run state SHA-256:
`b09890e17b6710b4c3c7ad091e78955cec944ffad4f42bbf5b54983ab0992140`.

Independent read-only comparison confirms all 15 prior runs, 28 prior failures,
historical grants and the archived predecessor retain their original values.
Only the three attempt-zero PR #55 inventory timestamps changed among old
decisions. The new candidate is terminal and non-retryable at attempt one, and
its pilot reservation is cleared. No content hash or successful-pilot marker exists.

The original lander is clean at the same commit. PR #55, publication and schedules
remain untouched. The localhost product-demo preview is an older post-fix review
artifact; it is **not** this run's output. The consumed grant is not permission
for another paid attempt.

## Next engineering decision

Pause paid proof attempts. Before another run, review a replacement for the
ever-growing pronoun exception list and a composition/repair contract that budgets
source-derived coverage across body, FAQs and metadata. Test them against retained
failures and adversarial unsupported-product cases before using live credentials.
Do not silently accept model approval, loosen source limits, rewrite this artifact
by hand, or relabel offline replay as an uninterrupted success.

No new credential is needed to diagnose these two local software/content problems.
Scoped unattended access, paid keyword metrics and human release approval remain
separate future dependencies, not explanations for this run's failure.
