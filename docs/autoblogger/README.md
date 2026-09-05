# VideoClaw persistent autoblogger v1

This worker is a controlled research-and-drafting system. It does not publish articles. Its production boundary is:

`candidate queue → US/en SERP validation → paid keyword metrics → ten deep checks → up to three drafts → native lander QA → one draft PR per article → human review`

The initial 250-topic research library is an input, not a quota or publication gate. Each run scans at most 50 candidates, deeply checks at most 10, and produces at most 3 drafts with no more than 2 from one ICP.

Operator status on 2026-09-06: the user approved one live artifact-only pilot, but it has **not run**. `APIFY_TOKEN` is connected to ICP Actions secrets. No `OPENAI_API_KEY` or `LANDER_READ_TOKEN` was found in the known local configuration or repository secret-name inventory. Those credentials remain blockers; approval is no longer the pilot blocker. PR #1 and lander PR #55 remain **open/unmerged**, and `AUTOBLOG_SCHEDULE_ENABLED=false` was verified on GitHub. No production action, generated lander PR or schedule activation is authorized. The ICP default branch is `seo-campaign`; GitHub schedules require the workflow there.

See the updated [three-lane system diagram](../diagrams/videoclaw-seo-aeo-geo-content-system.md) for the worker, current pilot and separate human release boundary.

## Apify-first operation while metrics are pending

Use the existing `KEYWORD_PROVIDER=pending` path for research and the one artifact-only pilot. Apify supplies US/en organic results, autocomplete, related searches and People Also Ask where present. Missing signals still fail their evidence gates; observing a SERP does not establish search volume.

This is **not** a DataForSEO integration. Supported adapters remain `pending`, `semrush` and `ahrefs`. Do not set `KEYWORD_PROVIDER=dataforseo`, substitute the Apify token for provider credentials, or fill volume/difficulty/CPC using SERP counts or an unverified actor's estimates. Adding DataForSEO later requires a tested adapter and authenticated metrics; its lack does not block the pending-metrics pilot. Recurring and normal draft-PR mode still require observed paid metrics.

Current pilot setup:

1. Add `OPENAI_API_KEY` and a separate fine-grained `LANDER_READ_TOKEN` as Actions secrets in **VideoClaw-ICP**. The lander token needs only contents:read and pull requests:read on the lander. Do not paste keys into chat, PRs, Markdown or tracked configuration.
2. Keep `KEYWORD_PROVIDER=pending`, `LANDER_BASE_REF=seo/founder-video-blog-launch` and `AUTOBLOG_SCHEDULE_ENABLED=false`. Keep the configured model exact; there is no silent model fallback.
3. Once the reviewed workflow is available for manual execution, run `pilot` once. If testing the branch locally instead, supply the same runtime credentials and configured checkout; do not replace read-only inventory with a write-capable publication token.
4. Retain and inspect the Markdown, SVG, source evidence and native validation report. Do not open a generated lander PR, consume another pilot, change approvals, merge, deploy or activate scheduling.

Built-in ImageGen can update the architecture illustration without an OpenAI API key. That does not provide credentials to the worker's separate OpenAI Responses API drafting step.

## Safety boundary

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
