# One-use local retry — 6 September 2026

The user approved one additional artifact-only attempt after the automatic source
input defect was fixed. This is not permission to reset the candidate, raise the
normal retry limit, substitute evidence, publish, or activate scheduling.

**The fully automated article milestone remains unproven.** Fresh diagnostics
found no qualifying PAA evidence for the retained candidate. The extra attempt is
therefore not spent on a run already known to fail its evidence gate.

## Retry boundary

- Candidate: `vc-c2-001`, `demo day video checklist`.
- Previous failed run: `automated-pilot-2026-09-06-attempt-3`.
- Authorized new run: `automated-pilot-2026-09-06-approved-attempt-4`.
- Normal retries remain capped at three.
- An explicit local approval records the exact six candidate identities, old/new
  run IDs, reason and approval time. It is consumed only when that exact manual
  artifact-only run reserves attempt four.
- Earlier decisions, failures and run records are retained. A consumed grant
  cannot be reused, transferred to another candidate/run, or used by scheduled
  execution or publication. A failed fourth attempt is terminal.
- The successful-pilot limit remains one. An approval is not an article approval,
  model result, native QA pass, or publishing credential.

The local entry point accepts an explicit `--approve-retry-from` argument. It is
not an Actions retry setting and is not a general-purpose retry-limit override.
Do not execute it until fresh qualifying evidence exists:

```bash
pnpm exec tsx lib/autoblogger/local-pilot-entry.ts \
  --run-id automated-pilot-2026-09-06-approved-attempt-4 \
  --approve-retry-from automated-pilot-2026-09-06-attempt-3 \
  --execute
```

The approval was saved locally at **21:04:42 UTC on 5 September** without running
the worker. Reload and explicit same-run preflight passed. The attempt count is
still **3**, `manualPilot` is null, and the grant's `consumedAt` is null. All four
historical run records, thirteen failure records, candidate decisions, legacy
candidate projections, content hashes and PR outcomes were checked unchanged.
The retained candidate was restored to the queue under its same six identities.

The real-state check also exposed an older `researched` projection linked to a
failed manual run. The grant accepts only such proven-stale pre-draft progress,
without rewriting it. Drafted/validated/PR-opened, newer or scheduled projections
remain blocked. Supporting historical records are pinned during compaction.

## Fresh evidence checks

These were diagnostic provider/browser reads, not another worker reservation,
article-generation run, or manual evidence supplied to a draft.

| Query check | Result | Apify run / dataset |
| --- | --- | --- |
| Exact `demo day video checklist` | Zero PAA | `zTHDKTB3gkHqqjDEg` / `zg7M4fy7Ar92KsMku` |
| Exact query alongside a product-demo comparison query | Exact query still zero; nine questions belonged to the other query | `SsmnNMdd3B9ep2y1q` / `INHexvP3EZ8WmVfPp` |
| First two related queries actually recorded in prior target SERPs: template and free-checklist variants | Both zero PAA | `560LkWHBzFC9PzxBe` / `dpdQgBbvPOdDWa4f0` |

The first two jobs completed around 20:36 UTC on 5 September. The related-query
job completed at 20:45:47 UTC. Browser checks, including a non-personalized view,
also found no PAA for the exact target. Four questions for the different
product-demo query were independently visible in Google, but none of that query's
nine questions passed the existing target-relevance selector. They were not
relabelled as the target query's observations or used to satisfy its gate.
An absent PAA component does not establish zero search demand. Volume, difficulty
and CPC remain unknown; this result concerns the current FAQ-evidence requirement.

The earlier nine target-query questions used by attempts two and three were
provider-reported recent observations, not independently browser-confirmed facts.
They are now outside the one-hour freshness window. Their timestamp was not
extended, and they were not injected into a new run.

A separate source-input recheck at 20:37 UTC automatically fetched four pages and
validated 35 body facts. It used zero model calls/retries and left state unchanged.
This confirms the input fix, not the full automated article milestone.

## Software verification

- Full suite: **921 tests passed across 49 files**, including the offline
  end-to-end/native-contract fixtures.
- Repository lint, typecheck, build and whitespace checks passed. A type-narrowing
  error found by the initial typecheck was fixed before the final rerun.
- Regression tests cover the unchanged normal retry cap, one-use/run/candidate
  binding, denied scheduled/publication use, consumed-grant rejection, reload of
  an identical unused grant, fourth-attempt failure recording, and retained audit
  records across bounded history compaction. The real legacy-projection case is
  covered, with negative controls for conflicting progress or successful output.
- Independent final review found no outstanding P1/P2 findings in the scoped
  patch and independently passed 191 focused tests.
- Both actual runtime credential values were checked against the proposed patch;
  neither is present. Private diagnostics and state are excluded from Git.
- The lander checkout remained clean at
  `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; PR #55 remained open/unmerged and
  `AUTOBLOG_SCHEDULE_ENABLED` remained `false` on a fresh check.

Existing gray-matter direct-eval and vinext mixed-import build warnings remain.
The worker build is not a native build or approval of a newly generated article.

## Result and remaining boundary

No new Markdown article, lander PR, model call, native generated-article QA pass,
deployment, production change or schedule activation resulted from these checks.
The previous three failures remain historical failures. The outstanding data gate
is three fresh, relevant, traceable PAA questions for this candidate—not a missing
OpenAI or Apify credential.

Changing the target opportunity or the evidence policy is a separate decision.
Neither has been done simply to obtain a passing run. The older assisted article
remains separate and does not count toward this engineering milestone.

All work belongs to [worker PR #1](https://github.com/frenzy2004/VideoClaw-ICP/pull/1).
