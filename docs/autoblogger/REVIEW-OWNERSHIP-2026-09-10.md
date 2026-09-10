# Review ownership and article-quality proof — 10 September 2026

## Scope

Worker PR #1 only, branch `automation/persistent-autoblogger-v1` into
`seo-campaign`. No lander edits, generated PRs, production operations or schedule
activation. Original lander remains clean at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.

## Request-boundary correction

Commit `3e7eb7ad3d0be9f9a0ecf4c6098596510f0b8df9` separates exact source
accounting from semantic review. Code-generated budget/allocation findings still
reach the repair, but no longer ask the final model for a second, estimated
numeric verdict. The model independently classifies every current binding and
checks support/copying; code calculates public derived words and enforces both the
180-word hard limit and captured non-growing repair ceilings. Semantic issues are
never dropped by matching their code string. Old saved negative verdicts still
reject through the unchanged finalizer.

Publisher attribution is checked per publisher–proposition pair, not by pooling
facts across publishers. A missing pair remains unsupported even in private
competitor-gap metadata. Only initially flagged locations gain repair authority.

Verification at that commit: 2,469 tests across 58 files, no failures/skips, plus
lint, typecheck and worker build. A concurrent first run hit the existing
five-second content-map rendering timeout; the complete three-worker rerun passed
without changing the timeout. A stale prompt-text assertion was replaced with two
real attribution-routing tests. Independent review reported no actionable defects.

## Paid retained-input diagnostic

`review-ownership-live-diagnostic-2026-09-10` used the unchanged automatically
researched context and generated testimonial draft. It is not a new worker run.
Three capped requests used `gpt-5.5`, high reasoning, a 48,000-token output ceiling
and a 600,000ms timeout. Each returned HTTP 200 as `gpt-5.5-2026-04-23`:

| Stage | Input tokens | Output tokens |
| --- | ---: | ---: |
| Fresh critique | 37,155 | 19,910 |
| One repair | 66,270 | 9,857 |
| Final review | 40,172 | 21,295 |

The initial critique caught the previously missed named-publisher attribution,
unsupported collection-benefit comparison and viewing-prevalence premise. The
repair passed assembly and citation/word-growth checks. Final semantic review
approved the repaired article with all issues resolved and no new issues.

**The diagnostic still failed.** Final source-derived counts were
167 / 260 / 155 / 59, against captured ceilings 75 / 120 / 61 / 22. Nine unchanged
spans moved from `original_guidance` to `source_claim`, including direct-answer
summaries, source-derived duration ranges and advice against scripted answers.
Code correctly retained the source-budget/growth failures. No native QA, accepted
article or worker-pilot success resulted. This is not an editorial approval for
publication.

Private receipts remain under the diagnostic artifact directory. The exact old
state hash remained
`afa9448ad5ab8a9813fbfd5b7aa1b0acc31a7570629896e9ae59ebeccdbbb6f9`:
20 runs, 33 failures, no consumed successful pilot. Original receipts and both
checkouts were unchanged during the diagnostic.

## Follow-up correction

Both review stages now explicitly distinguish support from derivation. Their
rationale precedes classification in the provider schema. Repeating, combining or
narrowing source advice remains source-derived even when written as an imperative;
original guidance must identify the new operational choice/tool contributed by
the article. No historical verdict or draft is rewritten to apply this rubric.

The existing bounded model settings are now available through runtime configuration:

| Variable | Default | Validation |
| --- | --- | --- |
| `OPENAI_REASONING_EFFORT` | `low` | `none`, `low`, `medium`, `high`, `xhigh` |
| `OPENAI_MAX_OUTPUT_TOKENS` | `24000` | Positive decimal integer, at most `128000` |
| `OPENAI_TIMEOUT_MS` | `240000` | Positive decimal integer, at most `600000` |

Explicit client options take precedence. Malformed or empty configured values
fail before a request. No automatic retries, reasoning escalation or model
substitution were added. These values are not credentials; existing provider
credentials stay in private ignored runtime files.

Independent review caught that the production CLI initially discarded these
settings. The CLI now validates the same shared limits, the production client
receives them, and the Actions preparation job maps the optional repository
variables. Caller-level regressions failed before that correction and now pass.
The complete follow-up check is 2,487 passing tests across 58 files, no failures
or skips, with lint, typecheck and build passing. Existing dependency build
warnings remain. This verifies the software, not the pending fresh live article.

## Fresh full-worker attempt

`testimonial-questions-live-proof-2026-09-10` ran at commit `4776307` for the
previously observed query `testimonial video questions`, article identity
`vc-c4-d-36c0a28bfc7bad3a`. Only candidate identity was supplied; the worker
re-collected live US/en evidence. The explicit request profile was high reasoning,
48,000 output tokens and 600,000ms timeout, but no model request was reached.

The fresh scan collected eight organic results and nine PAA observations. It
stopped at shallow screening with `missing_relevant_paa` and
`missing_product_relevance`: zero deep inspections, zero drafts and zero native
QA runs. Several questions concerned hiring interviews, fake reviews and legal
consequences rather than customer testimonial videos. The three-relevant-FAQ
requirement remains intact; nine observed questions does not mean nine suitable
FAQs.

| Collection | Run ID | Dataset ID |
| --- | --- | --- |
| Autocomplete | `wwtfaffE5TXq6DtVs` | `MIhbrgLCud287SX2K` |
| Organic SERP | `zLghEcPOmOlcZo3RI` | `RrHldpNF1ao0SG3Z1` |
| PAA first collection | `DbNPjXqc1Qkcrm33L` | `PiZpYG5GfKKnHGEqn` |
| PAA second collection | `8LpNhQoUxPhEQfPFV` | `p9iSDvCH2ssjymZAa` |

The candidate remains terminal at attempt one. State now contains 21 runs and
35 failure records with `manualPilot: null`, hash
`75d88bd9b44bcfb531ae9008e4708aebcea245384e73dfbd7fbbd4023f7701eb`.
No old attempt, identity or receipt was reset. The lander checkout remains clean.

## Narrow product-relevance correction

C4's product screening now recognizes `testimonial video` and `video testimonial`
as existing GTM/customer-video use cases. Four positive regression cases failed
before the correction; four text-testimonial/hiring/legal negative controls
continue to reject. The policy and worker suites pass 126 tests. Independent
review found no actionable issue and confirmed that the scope already covers
customer interviews. This correction neither changes candidate history nor
waives PAA, source, paid-metric or publication gates.

Full verification after this correction: **2,495 passing tests across 58 files**,
zero failures/skips, and passing lint, typecheck and worker build. Existing
dependency build warnings remain.

## Research-only pre-screen

`topic-prescreen-2026-09-10` used the unchanged production research client on
three previously observed queries. Each returned eight organic results and ten
autocomplete suggestions. `testimonial video template` and `testimonial video
examples` each met the three-relevant-PAA screen; `customer testimonial video`
did not. The template's selected observed questions concerned creation, an example
and duration. Organic evidence is not paid volume/difficulty validation.

Autocomplete run/dataset: `moDSuzW9LGn0bXCEn` / `cdiQToQGWYOnJ659Z`.
Organic run/dataset: `QtM293mzHcJssmbbr` / `zBy6dE7UOEZycgPtg`.
PAA runs/datasets: `3dXjx5Jbhm3GuDnnL` / `yYmUUr9fPoYefCrQb` and
`0WFqS1PKNVZ6FjNQ3` / `4wtY6SB23M2jXaMwT`.

No OpenAI calls, candidate grants, persistent state writes or native QA occurred
during this pre-screen. The state hash above was unchanged. A full attempt must
still re-collect evidence and produce its own draft rather than inject this scan.

**The uninterrupted live article milestone is still unproven.** Research-only
pre-screening of distinct observed topics is not a successful worker pilot.
