# Bounded PAA completion and failure receipts — 10 September 2026

## Outcome and scope

The saved-review template article now passes native lander QA; see the
[separate revalidation receipt](FAQ-METADATA-PROOF-2026-09-10.md#saved-review-native-revalidation--passed).
The later fresh examples worker run failed at shallow screening. That exposed
a stage-ordering defect: the worker required three relevant questions before
allowing its existing bounded deep search to discover them. This checkpoint
corrects that ordering without lowering the final evidence requirement.

Only worker PR #1 is in scope. No lander edits, PR #55 changes, production
operations, generated lander PRs, publishing or schedule activation occurred.
The complete fresh research → generation → review/repair → native QA milestone
remains unproven. Saved-input diagnostics are not fresh worker successes.

## Latest fresh worker attempt — failed

Run `testimonial-examples-live-proof-2026-09-10`, code `3184aeb`.
Candidate `vc-c4-d-e6365860697faeb7`, keyword `testimonial video examples`.
Earlier research-only screening was not injected into the new run.

Eight organic results and nine raw observed PAA questions were collected, but
fewer than three were relevant. Google returned a different question set from
the earlier screen. The shallow gate rejected it before deep source discovery.
No source-body retrieval, OpenAI request, accepted draft, native QA or PR occurred.

| Collection | Run | Dataset |
| --- | --- | --- |
| Autocomplete | `sQE9azZRTC7auiBBY` | `T3Vw5SA4UEmfanZ6S` |
| US/en SERP | `d38aqiufZHeLatWG8` | `sFGOGbkX9SjvmcvDX` |
| PAA first attempt | `wsZKmqHiL5AR9Ggur` | `j7Br3hkFFLFKZPXqz` |
| PAA second attempt | `MAUwZPOFNPfepkmrU` | `5lQcRYrpOnMyCKm4U` |

State after failure: 23 runs, 38 failure records, `manualPilot: null`.
SHA-256: `6c8ead6d0d1a06ce3951450dd099be9ef86080622f47cf9573a5d2b9f338b851`.
The candidate remains terminal at attempt one. No retry or identity reset.

## Correction

- Shallow eligibility still requires live organic evidence, an observed search
  suggestion signal, product relevance and paid metrics for scheduled mode.
- The best ten may enter the existing deep discovery with zero, one or two
  relevant PAA questions. One support-search batch uses at most seven actual
  question or approved publisher-scoped queries, in US/en desktop results.
- Newly observed questions retain their actual support-query/run/dataset identity.
  They are not relabelled as primary-keyword PAA, nor are provider answers used
  as verified source facts.
- Deep output and the worker still require exactly three relevant, distinct
  questions before drafting. Existing body-source preparation remains mandatory.
  Generic, duplicate or incomplete question sets still fail.
- Source retrieval remains bounded to 24 candidate URLs; no extra search loop,
  draft repair, candidate retry, model fallback or pilot grant is introduced.

Independent review found a failure-path audit gap: a completed support search
could be lost when inspection threw. `ResearchInspectionError` now carries only
collection provenance, not bodies. The worker persists validated compact receipts
before FAQ rejection and after typed inspection failures. `deepInspected` counts
attempted slots, including failures, rather than only successful returns.
Malformed or secret-like failure metadata cannot escape this handler: the worker
keeps existing safe shallow provenance, records failure and releases the lease.

## Verification

**2,523 tests across 58 files pass**, with zero failures or skips. Lint,
typecheck and worker build pass; existing dependency build warnings remain.

Six new consumer regressions were observed failing before the relevant fixes:
real research completion from zero/one/two questions, worker admission of a
partial pool, real failed-discovery attempt/receipt accounting, and a returned
invalid FAQ set retaining its completed receipt. Generic and duplicate questions
continue to block in research, pilot and scheduled modes. Failures produce no
drafts or PRs and do not retain raw PAA answer content. Three additional regressions
failed before correction for date-only timestamps and synthetic secret-like
run/dataset IDs; all now preserve failure bookkeeping without persisting them.

Fresh research-only validation is the next bounded check. It must leave the
terminal candidate and state untouched and must not be reported as a worker pilot.
