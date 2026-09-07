# Fresh-topic live test — webinar repurposing

Date: 8 September 2026, Malaysia time. Scope: worker PR #1 on
`automation/persistent-autoblogger-v1`; no lander modification or production action.

## Outcome: rejected during research, not an end-to-end pass

The user approved one fresh, materially different topic through the live pipeline.
The selected hypothesis was `webinar repurposing`, for a GTM buyer turning a recorded
webinar into social video clips. It was not represented as measured demand.

Run `fresh-webinar-proof-2026-09-08` began at `2026-09-07T23:46:10.898Z` and ended at
`2026-09-07T23:46:41.426Z`. Fresh US/en research found eight organic results and
eleven pooled question strings, but the unchanged relevance selector could not
identify three questions addressing the repurposing task. Observations included
general webinar definitions, participation and effectiveness questions. Their
presence does not make them suitable FAQs for a clip-repurposing guide.

The worker recorded `missing_relevant_paa` and `no_eligible_opportunities`.

| Stage | Actual result |
| --- | --- |
| Fresh lander/PR/branch inventory | Passed, read-only interactive GitHub access |
| Candidate scan | One candidate, eight organic results |
| Paid keyword metrics | Still pending; no volume, KD or CPC claim |
| Relevant PAA eligibility | Rejected |
| Deep source-body inspection | Not reached |
| OpenAI draft / critique / repair | Not reached; zero model calls |
| Accepted Markdown / SVG | None |
| Native article QA | Not reached in this run |
| Generated lander branch / PR | None |

This is a correctly recorded research rejection, **not** completion of the
automatic research → drafting → critique/repair → native QA milestone. The earlier
[unchanged-article revalidation](AWAKE-PROOF-2026-09-08.md) remains a separate,
post-fix result and is not substituted for this test.

## Exact Apify provenance

| Observation | Run | Dataset |
| --- | --- | --- |
| Autocomplete | `0Y7P73WPh8houaTVQ` | `dfpJMdhakzsjMpyxa` |
| Exact US/en organic SERP | `NdxoTIFnr1RWJTkiT` | `11CPoaxLSbL2fhwgm` |
| PAA attempt one | `D0HaigoEukKSoFJF9` | `3de78F5OAzuJXtfCp` |
| PAA attempt two | `vnehP05wRgE7ciC5j` | `063XK5QvNiTfRs3W9` |

Question-only observations and reports are Git-ignored under
`artifacts/autoblogger/fresh-webinar-proof-2026-09-08/`. Raw provider data remains
in Apify. No article prose, source facts, FAQ questions or model verdict was
manually supplied or rewritten. No previous response was replayed.

## Bounded authorization and software correction

The previous permission was bound to the exhausted product-demo topic. A separate
`--approve-fresh-candidate` local option now allows one exact new candidate and run
at attempt one, after checking queue/backlog/history and fresh lander inventory.
It cannot combine retry flags, consume the old permission, run on schedule,
publish, reuse its run, or retry the old topic. The new grant is consumed before
paid research. Candidate and implementation hashes are rechecked during execution.

Tests first failed for the absent CLI and authorization, then passed. Independent
review found a missing candidate fingerprint on the zero-eligible run-level
failure. Two regression tests reproduced the persistence error; the correction
binds that failure to the exact fresh candidate and attempt. The live rejection
then persisted both failure records, released its lease and left the candidate
terminal at one. Review confirmed the correction; no gates were relaxed.

Final pre-run checks: **1,749 tests across 52 files**, lint, regenerated-route
typecheck, build and whitespace checks passed. Historical tenth-attempt lifecycle
tests use synthetic fixtures, not mutable local state or credentials. Existing
dependency build warnings remain.

## History and non-production boundary

Pre-run state SHA-256:
`2cd487b55e88b6eae1ae358d68f5d1be985bb143a01eb3c9d55fff2fc70a3619`.

Post-run state SHA-256:
`d4520f3785f3aa3a95f5e25eef0b987d6cdd89a87a9c1eb6415f2fcc07c57916`.

All fourteen earlier run records, twenty-six earlier failure records and both old
authorization objects retain their pre-run hashes. The old product-demo candidate
remains terminal at ten, with no eleventh-attempt path. Ordinary startup inventory
reconciliation refreshed timestamps on the three existing lander article records
(attempt zero); the complete decisions object is therefore not byte-identical.
No historical failed run was relabelled successful or reset.

The fresh grant is consumed and its failed candidate is terminal at one. There is
no successful pilot marker and no automatic second fresh-topic grant. The original
lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; PR #55 and
production remain untouched. `AUTOBLOG_SCHEDULE_ENABLED=false` was rechecked.

## Next decision

The immediate obstacle is topic-specific search-question evidence, not an OpenAI
credential or native renderer error. Select an opportunity only after it has three
relevant observed questions; do not choose another title and hope the same question
requirement will be met. A further paid proof run needs separate authorization.
Do not invent questions, weaken relevance or reset this failure to obtain a pass.
Unattended access, paid metrics, team review and publication remain separate gates.
