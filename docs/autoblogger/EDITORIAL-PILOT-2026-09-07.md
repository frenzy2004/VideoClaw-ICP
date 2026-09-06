# Editorial-quality live pilot — 2026-09-07

Scope: worker PR #1 only. The date is the operator's Malaysia date; API
timestamps below are UTC. No lander source, PR #55, production branch,
deployment, publication or schedule changes are authorized.

## Explicit execution boundary

The operator approved one additional artifact-only attempt after the current
candidate exhausted three attempts. This is not a retry-history reset:

- Candidate: `vc-c1-d-ab0e55b1dd7f78fa`, `product demo checklist`.
- Prior failed run: `automated-product-demo-attribution-pilot-2026-09-06`.
- New run: `automated-product-demo-editorial-pilot-2026-09-07`.
- The old alternative-candidate grant stays parked and unchanged.
- Both consumed target retry grants are archived unchanged in `retryHistory`.
- The new approval snapshots the failed third decision and is consumed once.
- Normal retry cap remains three; a fifth attempt is refused.
- The local transport permits at most four Responses API POSTs, counting HTTP
  and transport failures, and rejects the fifth before dispatch.
- No model fallback, second repair, manual evidence injection, copy rewriting,
  or lowered quality gate is permitted.

Prior state SHA-256:
`f98bfe604f68bab064bc455234b9e63c4da2cff955bee4ba6eeed9852ad0e177`.
Seven prior run records and 18 failure entries were retained. An in-memory
preflight verified reservation/failure transitions without writing that state.

## Software verification and independent review

The fourth-attempt positive and malformed-approval regressions failed before
implementation. Tests now cover exact identities/run binding, ordinary versus
extra-attempt authority, scheduled refusal, history/compaction, native-pilot
preparation, terminal fourth failure, and refusal of a fifth attempt.

Independent review found that a saved retry could be reloaded through the old
target-switch flag, avoiding the explicit retry command. Three RED regressions
reproduced it for attempts two, three and four. The switch branch now refuses
any existing retry. Final independent re-review ran **207 scoped tests**, all
passing, and reported no remaining P1/P2 in the scoped implementation. This is
engineering review, not article publication approval.

## Live execution

The runner performs fresh GET-only GitHub inventory before any paid request.
PR #55 was open/unmerged; the clean local review branch matched remote SHA
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. There was no remote worker-state branch.
Publication capability is absent from the local pilot.

Execution started at `2026-09-06T16:07:26.536Z`.

| Evidence | Run ID | Dataset ID |
| --- | --- | --- |
| Autocomplete | `8Ye6X2egrhkcUheqT` | `vNRqW5Nq5OZ5YvXTP` |
| Organic SERP | `eBJSXNvisyqApj5nd` | `LbGBjUtJidxmhds7a` |
| Dedicated PAA | `DMXWNpQ3Nu22st47D` | `8l4TTq2UtIflZb0mw` |

The fresh query returned eight organic results and nine observed questions.
Automatic source inspection completed at `2026-09-06T16:08:06.147Z`; draft
generation began at `2026-09-06T16:08:06.570Z`.

Raw responses, page passages, exact prompts and local state remain private,
ignored artifacts. Credentials are runtime-only and absent from this report.
Paid keyword metrics remain pending; SERP observations do not establish volume.

## Outcome

**Failed at final draft review; native article QA was not reached.**

All four GPT-5.5 requests returned HTTP 200, in the approved order:

| Stage | Completed (UTC) | Result |
| --- | --- | --- |
| Draft | 16:09:02.746 | Structured draft returned |
| Independent critique | 16:10:10.097 | Four issues identified |
| One repair | 16:10:51.682 | Repaired structured draft returned |
| Independent verification | 16:11:55.022 | Three initial issues resolved; single-source derivation and a recording-workflow heading remained rejected |

The first draft had a distinct 144-character description. Neither draft used the
repetitive process labels targeted by the earlier correction. The final three
FAQ questions were exact observed product-demo questions:

1. When starting a product demo, what should you do first?
2. Can you give me an example of a product demo?
3. How to run a good product demo?

Automatic retrieval verified four reachable source bodies, including a YC primary
source. Extracted fact counts were 1 from Presales.rocks, 10 from CloudShare,
2 from Product Marketing Alliance, and 2 from YC. The repaired article still
relied heavily on CloudShare. Independent verification rejected cumulative
single-source derivation against the worker's 180-word limit and a recording
heading whose cited facts cover demo planning/delivery, not recording. Neither
finding was overridden.

The deterministic product-reference checker separately rejected an instruction
about supporting material fitting the buyer's use case. The model review called
that span supported original guidance. This disagreement needs a scoped software
diagnosis; correcting it alone would **not** resolve the independent failures.
No new phrase exemption was added just to accept this draft.

Worker result: one scanned/eligible/deeply inspected opportunity, **zero accepted
Markdown bundles, zero native article validations, zero generated lander PRs**.
Two structured drafts remain private failed-run receipts, not approved articles.
No second repair, fifth request, offline success relabelling, manual evidence
injection, article rewriting or source-quota relaxation occurred.

The candidate is terminal at attempt four. State retains eight runs and 19 failure
entries; the extra grant is consumed, both older target retries are retained, the
parked old grant is unchanged, `manualPilot` is null, and no content hash exists.
Final state SHA-256:
`8afa248b30aebbc5ce32dba3820ba9f217f3e8907442560b3a25c0d2c496b67c`.

All four response receipt hashes verified. API-reported total tokens across the
four calls: **106,962** (not a dollar-cost estimate or Codex task usage).
The earlier saved article keeps its separate provenance and still does not pass
current editorial checks.

## Remaining engineering work

The clean research-to-native-QA milestone remains unproven. The next correction
should address source allocation and original article structure before drafting,
and product-reference classification—not spend another attempt on the same prompt
or waive the reviewer. Those corrections are **not implemented by this patch**.
Any further paid attempt needs separate explicit scope; this approval is consumed.

## Final repository checks

- Final scoped review: **207 tests passed**.
- Full suite with two workers, then one worker: **1,100 passed / 1 failed** in
  each run. The unchanged 250-row content-map rendering test exceeded its
  existing 5,000 ms timeout (5,415 ms and 5,230 ms respectively). No test,
  timeout or production content-map code was changed to hide this failure.
- Isolated rerun of the unchanged content-map file: **8/8 passed**; the
  250-row case took 2,316 ms. This does not relabel either full run as green.
- Repository lint, typecheck and build ran separately after the live pilot:
  **passed**. Existing gray-matter/vinext dependency build warnings remain.
- Whitespace checks and runtime-secret scanning passed.
- Final retained-state audit verified the old grant and both consumed retry
  records unchanged, all seven prior run IDs retained, and no accepted article.
- The original lander checkout remains clean on its review branch; schedule
  remains `false`. No new live-article browser/Lighthouse/native build is claimed.

An earlier full run before the final three reload regression cases passed 1,098
tests. That is historical evidence, not a substitute for the final full-suite
failure reported above. This patch is a review checkpoint, not a green release.
