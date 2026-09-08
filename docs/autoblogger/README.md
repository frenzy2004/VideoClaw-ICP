# VideoClaw persistent autoblogger v1

This worker is a controlled research-and-drafting system. It does not publish articles. Its production boundary is:

`candidate queue → US/en SERP validation → paid keyword metrics → ten deep checks → up to three drafts → native lander QA → one draft PR per article → human review`

The initial 250-topic research library is an input, not a quota or publication gate. Each run scans at most 50 candidates, deeply checks at most 10, and produces at most 3 drafts with no more than 2 from one ICP.

Latest operator checkpoint on 2026-09-09 Malaysia time: the [FAQ evidence and bounded repair correction](FAQ-REPAIR-FIX-2026-09-09.md) screens every FAQ against actual body passages before generation and enforces exact repair locations, unchanged surrounding copy/bindings and non-growing reviewed source use. The offline 50 → 10 → 3 fixture passes; a fixture artifact also passes the full lander's 32 blog tests, lint and Next build in a disposable checkout. **This is software/fixture verification, not a new successful live article.** No paid call, retry reset, generated lander PR, production change or schedule activation occurred.

The prior [context/budget correction and video-marketing proof](CONTEXT-BUDGET-PROOF-2026-09-08.md) remains failed: three new unsupported assertions and two source-use overages (215/233 versus 180 words) prevented an accepted article or native QA. The candidate is still terminal at attempt one. The uninterrupted live milestone remains unproven, and no additional paid attempt is queued.

The previous [content-repurposing proof](SCREENED-CONTENT-PROOF-2026-09-08.md) remains a separate failed run. Its captured copy, independent verdict and state were not rewritten or relabelled as successful.

The preceding [webinar-repurposing test](FRESH-WEBINAR-PROOF-2026-09-08.md) remains a separate research rejection. Evidence-first screening resolved that obstacle for the new candidate; it did not establish paid keyword demand or repair quality.

Previous checkpoint: the [awake-attempt and revalidation report](AWAKE-PROOF-2026-09-08.md) records the tenth product-demo attempt and its separate post-fix validation. The unchanged repaired article and original independent verdict passed the native lander's 32 blog tests, lint and build after reference-check corrections. That is post-fix revalidation, not an uninterrupted live worker success; it does not replace the latest rejected run.

All prior failures remain in the history; the candidate is terminal at ten and there is no eleventh-attempt path. The original failed run/state is unchanged; the separate review-only artifact does not set a successful pilot marker or authorize a generated PR. Historical assisted articles, offline replays and synthetic fixtures are not substitutes for unattended proof. The [ninth-attempt report](QUALITY-REVALIDATION-2026-09-07.md) retains the sleep interruption, the [eighth-attempt report](SCOPE-ALIGNMENT-PILOT-2026-09-07.md) retains the copy/source-use failure, and the [sixth-attempt report](SOURCE-DISCOVERY-PILOT-2026-09-07.md) records the earlier title-scope and citation failure.

The earlier [review/repair correction](REVIEW-REPAIR-FIX-2026-09-07.md) fixed shared issue IDs, private campaign metadata and source-allocation checks. The [fifth live attempt](SOURCE-PLANNED-PILOT-2026-09-07.md) remains a historical failure with 226 derived words against the 180-word ceiling. The separately approved sixth run passed that ceiling but still failed other editorial checks.

The preceding [source-planning correction](SOURCE-PLANNING-FIX-2026-09-07.md)
adds bounded per-page evidence anchors, cumulative reviewed source-use accounting
and whole-article repair routing; it also fixes the ordinary-object reference
false positive. Offline replay of unchanged saved responses still blocks the old
article for source overuse and an unsupported heading. That correction was offline;
the separately authorized subsequent live test is reported above. The
[fourth-attempt report](EDITORIAL-PILOT-2026-09-07.md) remains historical evidence.

An [earlier artifact report](PRODUCT-DEMO-ARTIFACT-2026-09-06.md) records native QA passing only after a grammar correction and offline replay of unchanged saved responses. That historical result is not a clean live worker pass or current editorial approval.

**Subsequent editorial correction:** the [quality-check report](EDITORIAL-QUALITY-2026-09-06.md)
records tested description, repetitive-label and FAQ-selection fixes. The unchanged
saved draft now fails the stricter worker editorial checks; its earlier native QA
pass is historical, not current editorial approval. Re-selecting from the saved
observed question pool excludes the launch checklist and retains a product-demo
example question. No new article, model call, research request or retry was made.

The [previous product-demo retry](PRODUCT-DEMO-RETRY-2026-09-06.md), [collector correction](COLLECTOR-FIX-2026-09-06.md), [alternative-topic run](ALTERNATIVE-PILOT-2026-09-06.md), [earlier retry report](APPROVED-RETRY-2026-09-06.md) and [automated-pipeline report](AUTOMATED-PIPELINE-2026-09-06.md) retain historical checkpoints. Do not relabel any of them as successful or reset the exhausted candidate to run another pilot.

One older operator-assisted review article still exists separately. Its source audit, intervention and native QA are preserved in the [assisted-review report](ASSISTED-REVIEW-2026-09-06.md). It is not a successful `worker.execute()` result. The [research recovery report](RESEARCH-RECOVERY-2026-09-06.md) and [first pilot report](LIVE-PILOT-2026-09-06.md) retain earlier checkpoints.

`APIFY_TOKEN` is connected to ICP Actions secrets; `OPENAI_API_KEY` works locally only and `LANDER_READ_TOKEN` is still absent. Local attempts used fresh GET-only interactive GitHub inventory without substituting a broad token into the unattended worker. State/history is preserved and must be reconciled before Actions use. The one-use local retry authorization is not an unattended retry override. PR #1 and lander PR #55 remain **open/unmerged**, and the schedule is disabled. No production action, generated lander PR or schedule activation is authorized. The ICP default branch is `seo-campaign`; GitHub schedules require the workflow there.

See the updated [three-lane system diagram](../diagrams/videoclaw-seo-aeo-geo-content-system.md) for the worker, current pilot and separate human release boundary.

## Apify-first operation while metrics are pending

Use the existing `KEYWORD_PROVIDER=pending` path for research and the one artifact-only pilot. Apify supplies US/en organic results, autocomplete, related searches and People Also Ask where present. Missing signals still fail their evidence gates; observing a SERP does not establish search volume.

For Google SERPs, US/en means US targeting and an English interface (`hl=en`),
not a guarantee that every returned page is English. The optional English-page
restriction (`lr=lang_en`) is omitted after the controlled collector diagnosis.
Existing observations keep their original provenance; none were relabelled.

The organic collector is supplemented by a dedicated PAA actor when fewer than three
relevant questions are present. Two bounded attempts may be followed by automatic
lookup of at most ten recent actor datasets. Reuse requires exact query, US/en and
original timestamps within one hour; it is not relabelled as a current SERP feature.
PAA answer text, including AI overview answers, is never source evidence. Source
facts now come from automatically retrieved body passages, with complete adjacent
qualifications and separate fetch/hash provenance. See the
[automated-pipeline report](AUTOMATED-PIPELINE-2026-09-06.md).

Empty organic rows receive one bounded exact-query retry before the PAA stage.
Each result retains the selected observation's actual provenance and both
completed `serpAttempts`. Empty retry results still fail closed; they do not
prove zero demand or permit substitution of an older organic snapshot.

This is **not** a DataForSEO integration. Supported adapters remain `pending`, `semrush` and `ahrefs`. Do not set `KEYWORD_PROVIDER=dataforseo`, substitute the Apify token for provider credentials, or fill volume/difficulty/CPC using SERP counts or an unverified actor's estimates. Adding DataForSEO later requires a tested adapter and authenticated metrics; its lack does not block the pending-metrics pilot. Recurring and normal draft-PR mode still require observed paid metrics.

Unattended Actions setup (not the completed local research attempt):

1. Add `OPENAI_API_KEY` and a separate fine-grained `LANDER_READ_TOKEN` as Actions secrets in **VideoClaw-ICP**. The lander token needs only contents:read and pull requests:read on the lander. Do not paste keys into chat, PRs, Markdown or tracked configuration.
2. Keep `KEYWORD_PROVIDER=pending`, `LANDER_BASE_REF=seo/founder-video-blog-launch` and `AUTOBLOG_SCHEDULE_ENABLED=false`. Keep the configured model exact; there is no silent model fallback.
3. Once the reviewed workflow is available for manual execution, run `pilot` once. If testing the branch locally instead, supply the same runtime credentials and configured checkout; do not replace read-only inventory with a write-capable publication token.
4. Retain and inspect the Markdown, SVG, source evidence and native validation report. Do not open a generated lander PR, consume another pilot, change approvals, merge, deploy or activate scheduling.

Built-in ImageGen can update the architecture illustration without an OpenAI API key. That does not provide credentials to the worker's separate OpenAI Responses API drafting step.

## Safety boundary

- Ambiguous product references require current, context-hashed independent referent reviews. These cannot waive explicit product claims, rejected factual support, copying or source limits. Per-region source repair allocations cover FAQs and metadata but do not guarantee model compliance; the latest live attempt failed that gate.
- Short video-topic FAQ matching retains the video qualifier so generic marketing/editing questions cannot silently fill missing topic-specific slots. Exact observed wording and bounded collection provenance remain required; lexical relevance alone is not evidence that a source answers the question.
- Reader-facing editorial checks reject descriptions that repeat the title or fall outside the worker's 80–200-character house range, and repeated process labels in public prose. This is not a Google ranking rule or a semantic-quality score. Findings enter the existing single repair; independent support review remains required.
- FAQ selection uses observed wording only, distinguishes topic terms from article-format words, and prefers stronger topic matches. Lexical matching is conservative, not a guarantee of semantic relevance; missing three qualifying questions still blocks preparation.
- Generated articles are always `status: review`, have all approval flags set to `false`, omit `publishedAt`, and point only to `/download`.
- The worker cannot approve, publish, merge, deploy, or change production article state.
- A manual pending-metrics pilot creates exactly one short-lived workflow artifact and never invokes the lander PR publisher.
- Until PR #55 is merged, `LANDER_BASE_REF` remains `seo/founder-video-blog-launch`; all validated drafts remain artifacts.
- After PR #55 is included in `main`, scheduled runs still require paid metrics, a successful native lander validation, and a short-lived GitHub App installation token before they can open draft PRs.
- `reconciliation_required` is terminal. Never retry it automatically: inspect the retained remote branch and PR state first.
- Raw SERP results remain in Apify. Git stores only compact candidate decisions, exact run/dataset IDs, provider provenance, hashes, PR outcomes, and bounded redacted failures.

## CLI

Install with the locked package manager:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Commands:

```bash
pnpm autoblog research --run-id local-research-001 --artifact-dir artifacts/autoblogger/local-research-001
pnpm autoblog pilot --run-id local-pilot-001 --artifact-dir artifacts/autoblogger/local-pilot-001
pnpm autoblog run --phase prepare --run-id local-run-001 --max-drafts 1 --artifact-dir artifacts/autoblogger/local-run-001/prepare
# Run in a separate credential environment containing only the state and lander App tokens:
pnpm autoblog run --phase publish --run-id local-run-001 --max-drafts 1 --prepared-dir artifacts/autoblogger/local-run-001/prepare --artifact-dir artifacts/autoblogger/local-run-001/publish
pnpm autoblog validate --bundle artifacts/autoblogger/local-pilot-001/example.bundle.json --artifact-dir artifacts/autoblogger/validate
```

`research` performs bounded discovery, shallow SERP validation, metric enrichment, and deep evidence checks without drafting or requiring OpenAI. Researched topics remain available for later drafting; selection caps do not consume retry attempts. `pilot` is the single pending-metrics artifact-only proof. `run` requires an explicit `--phase prepare` or `--phase publish`. Only publish accepts (and requires) `--prepared-dir`; `--max-drafts` accepts 1, 2, or 3 and defaults to 1. The workflow uses 3 for scheduled runs. `validate` reruns the lander's native article checks against one stored bundle and returns a failure exit code when validation fails.

Prepare durably writes each Markdown/SVG/bundle and generated `.publication.json` before completing its candidate decision. The pilot additionally saves a non-expiring prepared hash reservation **before the first output write**: an uncertain filesystem write or lost final-state acknowledgement requires manual reconciliation and cannot release a second pilot. Pilot consumption still occurs only after the final artifact/report sync. Publish reads prepared files without invoking research, providers, or the model. It requires the same run ID, a validated scheduled-mode run, the exact set of prepared candidate decisions and identities, matching stored SHA-256 bundle hashes and provenance, and complete paid metrics. It reruns `Publisher.validateBundle` and retains the exact report object in the same publisher instance used to open each draft PR. Serialized QA reports cannot grant publication authority. PR #55 must be merged into `main`; the publisher repeats target, duplicate, and base-SHA checks before writing.

The CLI prints one compact JSON summary to stdout. Markdown, SVG, bundle JSON, publication envelopes, and the bounded QA report are written under the selected artifact directory using file sync, atomic rename, and directory sync. Pilot consumption occurs only after the final report write succeeds. Errors (including initialization/argument failures) produce a redacted `failure-report.json` where the artifact directory is writable, with machine-readable stderr as the fallback.

### Local retry diagnostic

For a separately authorized new topic after a consumed failed fresh-topic run,
the local entry point accepts `--candidate-file PRIVATE_CANDIDATE_JSON
--approve-next-candidate-from CLOSED_FAILED_FRESH_RUN_ID` alongside the required
fresh `--run-id` and final `--execute`. This is not automatic renewal or permission
to retry an old candidate. The predecessor must be a closed terminal first attempt;
its exact approval, decision, run and failures are archived and hash-bound. A prior
successful proof or publication blocks this path. A full queue is kept bounded
without losing the exact selected identity. The latest grant is consumed and
failed; no further execution is authorized by this documentation.

`local-pilot-entry.ts` is a narrow, explicit artifact-only diagnostic for the retained
`vc-c2-001` retry and existing local state. It is not an alternative unattended
credential flow or a generic way to start additional pilots. It verifies the clean
local lander against fresh GET-only GitHub inventory, retains all previous attempts,
and has no publisher capability. Its exact model/context replay receipts stay in
private, ignored local files; never commit them or attach them to a PR. A completed
pilot or exhausted retry budget causes preflight to refuse further execution by
default. The specifically authorized one-use exception binds a fourth attempt to
the retained candidate and a fresh manual run, without resetting any history. See
the [retry report](APPROVED-RETRY-2026-09-06.md) for its exact command and current
evidence blocker. It grants no publishing or scheduled-execution authority.

The later explicit target-switch form accepts `--candidate-file` (a private,
ignored identity-only JSON file) and `--switch-target-from` (the parked grant's
approved run ID). It records a distinct candidate/run authorization and preserves
the old grant and attempts. Research is recollected by the normal worker. The
switch used in the [latest pilot](ALTERNATIVE-PILOT-2026-09-06.md) is consumed;
rerunning it, changing its run ID, or invoking the parked retry is refused.
Reconcile and obtain explicit authorization before any further live attempt.

After the collector correction, an explicitly authorized same-target retry uses
`--candidate-file PRIVATE_CANDIDATE_JSON --retry-target-from FAILED_TARGET_RUN_ID`.
This records one current approval and the prior terminal decision; it does not
reset the consumed switch, decrement attempts, or unpark the old grant. A later
explicitly approved attempt retains the earlier consumed approval unchanged in
`retryHistory`. Ordinary retries stop at the three-attempt cap, and all
required prior run/failure records are pinned during compaction. The exact
candidate and fresh manual run are bound before paid work. Failure is terminal,
and success remains one review-only artifact. A consumed retry cannot be reused
or automatically renewed, combined with another authorization, or used in scheduled/PR mode.
Terminal cleanup of the old parked queue row does not resurrect its stale matrix
entry; the stored old decision, grant, run and failure history remain intact.

The separately authorized source-planning test uses `--approve-source-plan-retry`
with the exact candidate-file and failed-fourth target-retry arguments. It permits
one fifth attempt only after the failed consumed editorial grant, preserves that
grant in `retryHistory`, and cannot be reloaded using the old fourth-attempt flag.
This local-only authorization is now consumed. Normal retries remain capped at
three; no sixth attempt, publication or scheduled execution is authorized.

A separately approved fourth same-target attempt additionally requires
`--approve-target-extra-attempt` immediately before `--execute`. This records a
new `user_authorized_after_editorial_fix` approval, archives both previous
consumed retries, and binds the exact failed third attempt, candidate and fresh
manual run. It cannot authorize a fifth attempt or scheduled/PR execution. The
local transport refuses a fifth Responses API POST before sending it, including
when earlier calls failed. The normal retry cap and every quality gate remain
unchanged. Never add this flag without explicit operator approval.

## Runtime configuration

Repository variables:

| Variable | Initial value | Purpose |
| --- | --- | --- |
| `AUTOBLOG_SCHEDULE_ENABLED` | `false` | Enables the Monday schedule only after approval. The scheduled job is gated before checkout or API use. |
| `LANDER_BASE_REF` | `seo/founder-video-blog-launch` | Keeps output artifact-only until PR #55 is merged. Change to `main` only after verifying the merge. |
| `KEYWORD_PROVIDER` | `pending` | Use `pending` for research and the one pilot. Use `semrush` or `ahrefs` for scheduled runs. |
| `OPENAI_MODEL` | `gpt-5.5` | Exact Responses API model. Model failures are closed; there is no fallback. |

Repository secrets:

| Secret | Required for | Notes |
| --- | --- | --- |
| `APIFY_TOKEN` | `research`, `pilot`, `run --phase prepare` | Connected. Apify US/en autocomplete and first-page Google SERPs. Rotate the supplied burner token after the pilot. |
| `OPENAI_API_KEY` | `pilot`, `run --phase prepare` | Pending. Structured draft, independent critique, one repair, and repair verification; never required for research. |
| `SEMRUSH_API_KEY` | preparation with Semrush | Volume and keyword difficulty must both be observed. |
| `AHREFS_API_KEY` | preparation with Ahrefs | Alternative to Semrush; volume and difficulty must both be observed. |
| `LANDER_READ_TOKEN` | private checkout and prepare inventory (`research`, `pilot`, `run --phase prepare`) | Separate fine-grained PAT restricted to lander contents:read and pull requests:read (metadata read implicit). Required before PR #55 merges too; state and publication tokens are rejected. |
| `LANDER_APP_ID` | post-merge `run` | GitHub App identity used by `actions/create-github-app-token`. |
| `LANDER_APP_PRIVATE_KEY` | post-merge `run` | GitHub App private key. Never expose it as a normal environment or state value. |

No secrets are defined at job scope. Install, tests, typecheck, lint, and build receive no paid or publication secrets. Both checkouts use `persist-credentials: false`; every action is pinned to a full commit SHA resolved read-only from its official tag on 2026-09-05 (the pnpm annotated tag was dereferenced).

`GITHUB_TOKEN` is the normal Actions token and is passed only to the runtime steps for `VideoClaw-ICP`'s `autoblogger-state` branch. It is never used against `videoclaw-lander`. Paid/provider keys exist only in prepare; the model key is omitted for research. `LANDER_GITHUB_TOKEN` exists only in publish, comes from the GitHub App action, and must differ from the state token. Publish rejects any supplied model or paid-provider keys and validates App token shape and expiry before target inspection. Local publication requires `LANDER_TOKEN_EXPIRES_AT` as an ISO timestamp within the actual token lifetime. The workflow sets a conservative 40-minute deadline immediately after minting the one-hour installation token.

Private lander access is an explicit gate: the workflow requires `LANDER_READ_TOKEN`, then checks out the selected lander ref with only read access. The runtime's `LANDER_REPOSITORY` must point to that local checkout (the workflow uses `.autoblogger-lander`); unauthenticated remote clone URLs are rejected by the worker runtime. Native validation clones the local checkout into a disposable directory and strips remote credentials before install/check/build commands. For local operation, provide an existing checkout of the configured `LANDER_BASE_REF`. The standalone `validate` command can use a local checkout too. No claim of premerge private access is made until the read token is configured and checkout succeeds.

Prepare also receives `LANDER_READ_TOKEN` for fresh GitHub inventory before any Apify, keyword-provider, or model request. The credential uses a distinct `github_read_only` auth kind; only inspection accepts that kind, and mutation methods require an App installation token. Configure a `github_pat_…` fine-grained PAT with only contents:read and pull requests:read; GitHub must authorize both API surfaces or preparation fails. It must differ from the same-repository state token and cannot be the publication App token. Publish receives no read PAT. Local article inventory is supplemented by current articles at the configured ref, all open PR article identities, and remote branch reservations. Manual PRs are included: primary-keyword bullets are parsed, and changed `content/articles/*.md` blobs supply ID, title, slug, and keyword even when the PR body has no metadata. Multi-article PRs contribute each article separately. Paginated/truncated/malformed inventory, unreadable article blobs (including inaccessible fork blobs), and missing article identities stop preparation before paid calls; the worker does not silently use partial inventory.

After this checkout, the workflow runs `npm ci` in the lander and explicitly runs `pnpm test lib/autoblogger/offline-e2e.test.ts` with `AUTOBLOG_NATIVE_LANDER_PATH` pointing to it. These steps receive no provider, model, App, or state secrets. The earlier general unit suite may skip its optional native fixture when no local checkout is detected; the later explicitly configured native suite must run, and an explicit missing path must fail. This fixture does not replace the runtime publisher's fresh native install/check:blog/lint/build validation.

## GitHub App

Install a least-privilege App on `INFR-Organisation/videoclaw-lander` only:

- Repository metadata: read (implicit)
- Repository contents: read and write
- Pull requests: read and write

The App does not need administration, Actions, deployments, environments, issues, members, secrets, or organization-wide write permissions. The worker API exposes branch/commit/draft-PR operations only; no merge or approval operation exists.

## State and idempotency

The workflow's concurrency group prevents overlapping runs. Compact state is stored at `state.json` on `autoblogger-state` through an optimistic file SHA:

- candidate fingerprints and lifecycle decisions;
- one-pilot consumption marker;
- Apify run and dataset IDs plus metric provider/observation provenance for all scanned/enriched candidates;
- generated content hashes;
- PR number/status when known;
- the latest 100 bounded, redacted failure records.

A state SHA conflict stops the run. Local and fresh remote lander articles, open PR article identities, remote autoblogger branch reservations, backlog identities, and state identities are reconciled before paid research or drafting. Publish refreshes target inventory, and the publisher repeats the decisive duplicate check immediately before a remote write. Selected discovered candidates remain in the queue while leased so recovery retains their full candidate data.

Before any publication attempt, a CAS state write marks all prepared candidates `manual_attention/publication_in_progress` and the run failed until publication is fully acknowledged. Each confirmed PR is then recorded durably. Completed, missing, modified, uncertain, or already published state blocks replay. A crash or lost state/PR acknowledgement leaves the conservative in-progress marker; it has no automatic retry lease. Stop and reconcile the stored bundle hash, remote branch, and PR before an operator repairs state. Do not simply delete decisions or mint a new run ID to republish an uncertain artifact.

## Pilot and rollout

1. Keep `KEYWORD_PROVIDER=pending`, `LANDER_BASE_REF=seo/founder-video-blog-launch`, and `AUTOBLOG_SCHEDULE_ENABLED=false`.
2. Configure lander read access and OpenAI before triggering `pilot` manually. It can be consumed once and can create only one artifact. `research` needs no OpenAI key, but still needs its research credentials and lander read checkout.
3. Review the Markdown, deterministic 1200×675 SVG, sources, frontmatter, and native lander QA report.
4. Wait for PR #55 to merge and verify that its merge commit is included in `main`.
5. Install the GitHub App, add one paid keyword provider, and set `LANDER_BASE_REF=main`.
6. Prove two manually triggered `run` executions with `max_drafts=1` (the default), each opening one acceptable draft article PR. The operator must keep this cap for both proving runs; no rollout counter automatically enables scheduling.
7. Set `AUTOBLOG_SCHEDULE_ENABLED=true` only after explicit team approval. The schedule is Monday at 16:00 UTC.

Turning on the schedule does not turn on publishing. Every generated article still requires copy, design, and source approval plus a human merge in the lander repository.

## Failure and cost handling

- Apify polling, HTTP requests, source bodies, command execution, and the workflow job all have finite bounds.
- Shallow autocomplete now queries only the fifty seeds, without 27-fold alphabet expansion. Client execution defaults to at most 150 polls within 150 seconds, allowing the existing bounded server job to finish and return its dataset. Missing evidence still fails closed.
- Actor launches also default to Apify's server-side `timeout=120` seconds and `maxTotalChargeUsd=2` per actor run. The $2 setting caps supported pay-per-event charges; it is **not** a total account, total workflow, or universal compute-cost cap. Multiple actor runs can each incur charges. Bounded client polling and best-effort abort complement the server timeout and do not guarantee instantaneous cancellation.
- The model path is exactly draft → critique → optional single repair → verification critique. Unresolved issues fail closed.
- Source requests pin the DNS result, reject public-to-private redirects, stream with a byte cap, avoid proxy environment reuse, and cancel on abort or early iterator return.
- Scheduled eligibility requires an organic result, a suggestion/PAA/related signal, observed volume and difficulty, two reachable sources including one authoritative source, three PAA-grounded FAQs, and clear VideoClaw/ICP relevance.
- Candidate errors are recorded and do not increase the 50/10/3 caps. There are no unbounded model retries.
- A failed PR operation rolls back a newly created branch only when GitHub positively proves that no PR exists. Ambiguous state is preserved for manual reconciliation.
- Workflow artifacts are retained for seven days. Do not copy API responses or credentials into tickets or PR comments.

## Operator checks

Run before opening or updating the implementation PR:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run check:autoblogger
git diff --check
```

No live Apify, OpenAI, keyword-provider, lander, GitHub, or Vercel call is part of the test suite.
