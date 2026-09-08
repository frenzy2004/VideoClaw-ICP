# Context-aware checks and the video-marketing live proof

Date: 8 September 2026, Malaysia time. Scope: worker PR #1 on
`automation/persistent-autoblogger-v1`. No original lander changes, generated
lander PRs, production writes, deployments, publishing or schedule activation.

## Outcome: checker corrections verified; article still rejected

The uninterrupted automatic research → drafting → critique/repair → native QA
milestone is **not proven**. One fresh artifact-only attempt completed research
and four model calls, but final content review rejected the repaired article.
No accepted Markdown/SVG bundle was created and native article QA was not reached.

Run: `context-budget-video-marketing-proof-2026-09-08`.
Observed preflight through completion: `2026-09-08T15:00:16.687Z`–
`2026-09-08T15:07:20.844Z`.

| Stage | Actual result |
| --- | --- |
| Candidate | `video marketing`, GTM/content-repurposing buyer |
| Intended article | Video Marketing: Build a Practical Startup Video Workflow |
| Read-only lander inventory | Clean `b6b0833c78443b44b12bf6d33f05baa7ac8427d3` |
| Fresh exact US/en SERP | Eight organic results, ten observed question strings |
| Selected FAQs | Definition of video marketing; AI video marketing; cost |
| Supporting evidence | Four automatically retrieved HTTP-200 page bodies |
| Draft / critique / one repair / verification | Four completed HTTP-200 GPT-5.5 requests |
| Product-reference checks | Six repaired-draft ambiguities resolved by current independent reviews; no remaining reference findings |
| Final evidence check | Three unsupported assertions, also reported by three rejected support bindings |
| Final source-use check | Two overages: 215 and 233 words against the unchanged 180-word ceiling |
| Accepted bundle / native QA / generated PR | None / not reached / none |

Candidate selection was operator-supervised. The live worker independently
recollected the evidence; screening snapshots were not injected into drafting.
No source fact, generated copy, FAQ, support classification or verdict was manually
rewritten. Paid keyword metrics remain pending, not estimated from SERP counts.

## Software corrections

### Context-bound independent reference review

Conservative pronoun detection now requests a separate referent judgment. The
review names the current binding, its hash, the complete draft-context hash,
the visible subject and a rationale. A non-product judgment can resolve only the
matching reference finding; it cannot approve evidence, copying, source overuse
or other safety failures.

Context includes rendered section headings, relevant title/graphic labels,
the FAQ question and preceding answer sentences. Independent adversarial review
caught and prompted fixes for cross-field antecedents, malformed section bindings,
missing FAQ/title context, Markdown-formatted headings and repeated questions
displacing answer context. Current negative and positive regressions pass through
inspection, materialization and final repair acceptance.

Explicit nearby product assertions, missing/stale/duplicate judgments and rejected
support remain blocked. Hash matching establishes receipt identity, not factual
truth; semantic judgment and human publication review remain necessary.

### Whole-article source repair planning

Repair now receives per-page, per-region and per-location allocations with current
binding hashes. The 120-word planning target covers body, direct answer, headings,
FAQs, description and graphics; the final 180-word ceiling is unchanged.

Valid accounting for rejected claims is retained, with unsupported/disputed spans
explicitly marked. Missing or stale reviews block planning. The planner does not
rewrite text, swap citations, relabel paraphrases as original, or approve claims.

Offline inspection of the prior content-repurposing failure identifies concrete
46- and 38-word reductions toward the planning target while retaining its rejected
claim. That old failure remains failed. The new live result below demonstrates
that a correct allocation plan alone does **not** make the model obey it.

### Short-topic FAQ relevance

Live screening exposed a separate defect: removing `video` from `video marketing`
left only `marketing`, admitting generic marketing-rule questions and suppressing
the missing-question collector. Short video compounds now retain the medium as a
required qualifier, including plural wording. Longer lexical topics keep their
existing matching behavior. This remains a conservative lexical heuristic, not
a semantic guarantee.

Tests cover both recovery with exact question/run/dataset provenance and refusal
after the two-attempt cap. A fresh collection then recovered on-topic observed
questions without manually supplying one.

## Screening and live provenance

The first bounded screen checked three new topics: video marketing strategy,
video marketing for startups, and repurposing content for social media. None was
chosen: two lacked sufficient matches, and the nominal startup match included a
generic marketing-rule question. The broader observed query `video marketing`
exposed the same filter defect. Its post-fix screen and source inspection passed.
These screens are separate from the exact live-run IDs below.

| Live observation | Apify run | Dataset |
| --- | --- | --- |
| Autocomplete | `bBrgqKBMeL2dy7gCZ` | `qffHxK85yZ5mrHggV` |
| Exact US/en organic SERP | `cVG7xGcftNVgmAEua` | `B245ucoZr7OVdxoY6` |
| PAA, one attempt | `JDt8imoJgJy9IXKsk` | `KoQwsmLGhYEu9QpIT` |
| Supporting-source searches | `kJTVX6M3fyO49kqbD` | `SAiBQzNBcg0CHyQFA` |

Automatically retrieved sources and independently reviewed source-use counts:

| Source | Initial derived words | Repaired derived words |
| --- | ---: | ---: |
| [Descript video-marketing guide](https://www.descript.com/blog/article/video-marketing-a-must-have-skill-for-marketers) | 87 | **215** |
| [Pipedrive video marketing](https://www.pipedrive.com/en/blog/video-marketing) | 39 | 81 |
| [Park University video marketing](https://www.park.edu/blog/the-rise-of-video-marketing-harnessing-the-power-of-video-content/) | 26 | 95 |
| [Amazon Ads video-marketing guide](https://advertising.amazon.com/library/guides/video-marketing) | 119 | **233** |

Each count aggregates the corresponding independent review's classifications,
not just surface word-count changes. All four sources returned HTTP 200 with
8–18 bounded body passages. Retrieval times/body hashes and private model receipts
remain local/ignored; raw SERP data remains in Apify.

## Why this repair is not acceptable

The verifier resolved the initial publisher-attribution, AI-capability and
email-nurture issues, then rejected three newly introduced assertions:

1. A claimed recurring reason startup videos become too long.
2. An unsupported two-week review cadence presented as a practical rule.
3. A claimed one-month comparative benefit of keeping a decision log.

Two source-derived totals also exceeded the unchanged ceiling. The finalizer
correctly refused the draft despite the six successful referent resolutions.
Hash-verified offline replay of the unchanged draft, original issue registry and
verdict reproduces all eight findings. All 109 repaired binding hashes match.

Separately, the repaired AI FAQ says the supplied sources do not define the term.
Although that avoids the earlier unsupported capability explanation, it fails to
answer the reader's question and exposes research-process language publicly. It
is an editorial weakness, not a publishable answer or evidence-coverage success.

## Verification and usage

All **1,850 tests across 52 files** passed before the live attempt, along with
lint, regenerated-route typecheck, build and whitespace checks. The full suite
started at 22:56:27 Malaysia time and took 163.29 seconds. The patch adds 50 tests
over the previous 1,800-test checkpoint. Independent scoped reviews found no
remaining concrete blocker in the reference/budget and FAQ corrections. Existing
dependency build warnings remain. These checks do not establish accepted content.

The post-run implementation hash still matches the live preflight; no code was
changed during execution. All 12 changed files passed exact runtime-secret scans,
the four checkpoint documents passed secret-pattern checks, and their local links
resolve. No credential, source body or raw model response is included in the patch.

Configured model `gpt-5.5`; all responses resolved to `gpt-5.5-2026-04-23`.
No fallback, fifth request, second repair or further live article attempt occurred.

| Stage | Input tokens | Output tokens | Total |
| --- | ---: | ---: | ---: |
| Draft | 10,812 | 8,292 | 19,104 |
| Critique | 29,992 | 10,032 | 40,024 |
| Repair | 40,414 | 8,649 | 49,063 |
| Verification | 33,490 | 10,651 | 44,141 |
| Total | **114,708** | **37,624** | **152,332** |

Cached input was zero; 650 reasoning tokens are included in output totals. This
is observed token usage, not a dollar estimate.

## Retained state and next engineering work

Pre-run state SHA-256:
`b09890e17b6710b4c3c7ad091e78955cec944ffad4f42bbf5b54983ab0992140`.

Post-run state SHA-256:
`05b1b876e2fa6226d139471aaf45c9b542e8ee6788bf97e0c4f3b7d598424bcd`.

All 16 prior runs and 29 prior failure records retain their original values.
Only `updatedAt` changed on the three pre-existing attempt-zero lander inventory
decisions. Content hashes and PR records are unchanged. The new candidate is
terminal at attempt one, with no successful pilot marker or active reservation.
The old lander is clean at `b6b0833`; the schedule remains disabled.

Before another paid article proof, the next engineering step should address
evidence coverage for each selected FAQ and constrain repair so that it does not
expand supported copy into new assertions or exceed source allocations. Evaluate
that change against captured failures before authorizing another live attempt.
Do not add exceptions for the rejected sentences, raise source limits, erase
failure history or treat the source-disclaimer FAQ as an acceptable answer.

Read-only unattended lander access, paid keyword-provider credentials and team
approvals remain separate dependencies. They do not explain this local content
failure and should not be presented as its blocker.
