# Distinct FAQ readiness checks

Date: 9 September 2026, Malaysia time. Scope: worker PR #1 only.

## Outcome

**The uninterrupted live article milestone remains unproven.** Two bounded,
paid research screens retrieved live US/en results and supporting page bodies.
Neither established three distinct, body-supported FAQ intents under the current
matching rules. No actual OpenAI request, full worker attempt, generated article,
native article QA run, retry grant, lander PR or production action followed.

This checkpoint fixes a real duplicate-selection defect. It is not a completed
research → draft → critique/repair → native QA proof.

## What the screens found

| Topic | Live evidence | Readiness outcome |
| --- | --- | --- |
| `testimonial video` | Eight organic results, four initial PAA questions, supplemental observed questions and four HTTP-200 source bodies | Initially reached the intercepted model boundary, but two selected FAQs were the same make/create intent. This was rejected on inspection, not counted as readiness. |
| `product launch video` | Eight organic results, supplemental PAA collection and four HTTP-200 source bodies | Draft preflight blocked two FAQ evidence gaps; no model boundary reached. |

The testimonial screen selected these questions:

1. How to make a testimonial video?
2. How to create a testimonial video?
3. How long should a testimonial video be?

The first two are one instructional intent. After the correction, an offline
check against the unchanged saved question pool and body facts finds only two
distinct supported intents: creation and duration. This check uses no new search,
model call or state write; it is not a rerun of the worker.

For product launch, the creation question has body anchors. The example-of-a-launch
and best-way-to-launch questions do not satisfy the current evidence matcher.
The preliminary eligibility object is `true`, but the actual drafting preflight
is blocked. Preliminary eligibility alone is not permission to generate.

The retrieval/matching limitation does **not** establish that answers do not
exist online. For example, a retrieved testimonial page defines “video testimonial”,
while the selected question says “testimonial video”; the current definition
matcher requires subject word order. Example-question handling is also limited.
Do not describe these failures as measured lack of search demand or lack of sources.

## Software correction and verification

`faqQuestionKey()` now treats the exact `How to make …` / `How to create …`
grammar as one intent. It retains the first exact observed wording and preserves
the rest of the subject, including tool, audience and with/without qualifiers.
Other operations and ambiguous modal questions remain distinct. No body-evidence
rule, publication gate, retry limit or model budget was weakened.

The consumer regression failed before the fix. Independent review caught an
additional qualifier collision: noun stemming merged Canva and Canvas. Its new
consumer regression also failed before correction. Creation keys now normalize
only a leading article, not noun endings. Independent re-review is clear.

- Final full suite: **2,170 tests across 55 files**, zero failed/skipped.
- Scoped research/FAQ suite: **304 tests** passed.
- Lint, typecheck and worker build passed.
- Existing dependency build warnings remain; this worker build is not a native
  Next build for a generated article.

## Paid research provenance

All eight runs completed successfully. Amounts are Apify's `usageTotalUsd`, not
an account invoice or the acquisition cost of a validated article.

| Topic / stage | Run | Dataset | Reported USD |
| --- | --- | --- | ---: |
| Testimonial autocomplete | `ixlcJrAZYSkzDGdas` | `GajPNMVnlLVZDr2Ab` | 0.00505 |
| Testimonial SERP | `g284pbdNDNe9Wjet6` | `igBReexhdwJrNLsOn` | 0.00295 |
| Testimonial support search | `LlI5LiorR8J2AxoZB` | `TnyF2z6d32vA6unrr` | 0.01465 |
| Launch autocomplete | `NwvL91oxXY1j8bUoM` | `PKQF6Po2YO5oqbSpN` | 0.00505 |
| Launch SERP | `aHa8HrxoEkkK8mWYv` | `ClTLYKAixphf8IlJf` | 0.00295 |
| Launch PAA attempt 1 | `FbacE23xdayRn8Hiz` | `FWlfXVR8e10gEegBe` | 0.01100 |
| Launch PAA attempt 2 | `QRAjsdAfSFwdaJm8D` | `ubJ88ZC50LGw4JcrR` | 0.01100 |
| Launch support search | `U9v6U3jzaxoetBBBY` | `1WSnCs5N0GQQBDF31` | 0.01465 |

Total reported research charges: **$0.06730**. OpenAI requests: **zero**.
Raw source bodies and screening receipts remain in ignored local artifacts;
no credential or page-sized source content is committed.

## Preserved boundaries and next decision

- Persistent state is byte-for-byte unchanged: 19 runs, 32 failures; SHA-256
  `8511a9c018e40588998f64da424e975d2309251e027ad924390cb11d8454cf89`.
- No exhausted candidate was reset, renamed or retried; no successor grant was consumed.
- [Worker PR #1](https://github.com/frenzy2004/VideoClaw-ICP/pull/1) and
  [lander PR #55](https://github.com/INFR-Organisation/videoclaw-lander/pull/55)
  remain open/unmerged. Original lander `b6b0833` is unchanged and clean.
- `AUTOBLOG_SCHEDULE_ENABLED=false`; no publishing, deployment or indexing.

The next engineering decision is how the FAQ retrieval screen should handle
semantically equivalent definitions and concrete examples while retaining exact
observed questions and genuine body evidence. Repeatedly changing keywords or
adding phrase-specific exceptions is not evidence of a reliable system. Resolve
that matching design before another paid article attempt. No broader matcher
redesign or new live attempt is authorized by this report.
