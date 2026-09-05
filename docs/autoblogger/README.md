# VideoClaw persistent autoblogger v1

This worker is a controlled research-and-drafting system. It does not publish articles. Its production boundary is:

`candidate queue → US/en SERP validation → paid keyword metrics → ten deep checks → up to three drafts → native lander QA → one draft PR per article → human review`

The initial 250-topic research library is an input, not a quota or publication gate. Each run scans at most 50 candidates, deeply checks at most 10, and produces at most 3 drafts with no more than 2 from one ICP.

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
pnpm autoblog run --run-id local-run-001 --artifact-dir artifacts/autoblogger/local-run-001
pnpm autoblog validate --bundle artifacts/autoblogger/local-pilot-001/example.bundle.json --artifact-dir artifacts/autoblogger/validate
```

`research` performs bounded discovery, shallow SERP validation, metric enrichment, and deep evidence checks without drafting. `pilot` is the single pending-metrics artifact-only proof. `run` is the paid-metrics path. `validate` reruns the lander's native article checks against one stored bundle; a serialized validation report cannot authorize a later PR.

The CLI prints one compact JSON summary to stdout. Markdown, SVG, bundle JSON, and the bounded QA report are written under the selected artifact directory. Errors and reports are screened for recognizable secret patterns.

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
| `APIFY_TOKEN` | `research`, `pilot`, `run` | Apify US/en autocomplete and first-page Google SERPs. Rotate the supplied burner token after the pilot. |
| `OPENAI_API_KEY` | `pilot`, `run` | Structured draft, independent critique, one repair, and repair verification. |
| `SEMRUSH_API_KEY` | `run` with Semrush | Volume and keyword difficulty must both be observed. |
| `AHREFS_API_KEY` | `run` with Ahrefs | Alternative to Semrush; volume and difficulty must both be observed. |
| `LANDER_APP_ID` | post-merge `run` | GitHub App identity used by `actions/create-github-app-token`. |
| `LANDER_APP_PRIVATE_KEY` | post-merge `run` | GitHub App private key. Never expose it as a normal environment or state value. |

`GITHUB_TOKEN` is the normal Actions token and is used only for `VideoClaw-ICP`'s `autoblogger-state` branch. It is never used against `videoclaw-lander`. `LANDER_GITHUB_TOKEN` exists only inside the run step and comes from the GitHub App action.

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
- Apify run and dataset IDs;
- metric provider and observation time;
- generated content hashes;
- PR number/status when known;
- the latest 100 bounded, redacted failure records.

A state SHA conflict stops the run. Re-run only after loading the new state. Existing lander articles, open autoblogger PRs, backlog identities, and state identities are checked before drafting, while the publisher repeats the decisive duplicate check immediately before a remote write.

## Pilot and rollout

1. Keep `KEYWORD_PROVIDER=pending`, `LANDER_BASE_REF=seo/founder-video-blog-launch`, and `AUTOBLOG_SCHEDULE_ENABLED=false`.
2. Trigger `pilot` manually. It can be consumed once and can create only one artifact.
3. Review the Markdown, deterministic 1200×675 SVG, sources, frontmatter, and native lander QA report.
4. Wait for PR #55 to merge and verify that its merge commit is included in `main`.
5. Install the GitHub App, add one paid keyword provider, and set `LANDER_BASE_REF=main`.
6. Prove two manually triggered `run` executions that each open acceptable draft article PRs.
7. Set `AUTOBLOG_SCHEDULE_ENABLED=true` only after explicit team approval. The schedule is Monday at 16:00 UTC.

Turning on the schedule does not turn on publishing. Every generated article still requires copy, design, and source approval plus a human merge in the lander repository.

## Failure and cost handling

- Apify polling, HTTP requests, source bodies, command execution, and the workflow job all have finite bounds.
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
