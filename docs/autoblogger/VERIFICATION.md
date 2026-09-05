# Autoblogger v1 verification

Scope: `automation/persistent-autoblogger-v1` into `VideoClaw-ICP:seo-campaign`.
No lander source changes, article publishing, production merge, deployment or schedule activation are part of this verification. Earlier offline checkpoints and the later authorized live local attempt are distinguished below.

## Live local checkpoint — 2026-09-06

The [live-pilot report](LIVE-PILOT-2026-09-06.md) records the result: OpenAI `gpt-5.5` structured preflight passed; Apify completed fifty US/en search observations; ten deep checks were attempted and none passed (eight source-gate and two relevant-PAA failures). Zero article-generation calls, generated articles, native generated-bundle builds or lander PRs occurred. This is **not** a successful end-to-end article pilot.

Three live integration assumptions were corrected: nullable Apify finish timestamps, 27-fold autocomplete expansion, and a client polling budget shorter than the observed 117-second SERP job. All were reproduced red before their fixes. Final verification: **567 tests passed across 44 files**, repository lint, typecheck, build and `git diff --check` passed. Existing gray-matter direct-eval and vinext mixed-import build warnings remain.

The OpenAI key is stored locally in an ignored permission-600 environment file, not installed as an Actions secret. Fresh interactive GET-only GitHub inventory and the existing local lander checkout enabled this local attempt without extracting or substituting a broad token. The standard worker's fine-grained read-token/App requirements remain unchanged. Both PRs were verified open/unmerged and `AUTOBLOG_SCHEDULE_ENABLED=false`; all four pilot-created Apify runs were verified terminal. The local state and diagnostic files remain ignored and must be reconciled before future unattended execution.

## Earlier automated coverage

Final local verification on 2026-09-05: **564 tests passed across 44 files**, including all native-fixture cases. Typecheck, repository lint, the ICP production build and `git diff --check` passed. Socket tests were run with localhost permission. No paid-provider or model request was made.

Reverified on 2026-09-06 for the Apify-first pilot runbook and diagram update: **564/564 tests across 44 files**, lint, typecheck and build passed. The initial sandboxed run had seven `listen EPERM 127.0.0.1` failures; the unchanged suite passed after granting localhost socket permission. Build output still includes dependency warnings from gray-matter direct eval and vinext mixed imports; no clean-warning claim is made. No worker runtime code or publication gate was changed in this documentation update.

The stored Apify token authenticated successfully through a read-only `/v2/users/me` request (HTTP 200). No actor or model request was started and no account details or token value were printed. Secret-name checks found `APIFY_TOKEN` only; the user has approved one artifact-only pilot, but the absent OpenAI key and lander read token still prevent that live run. Both PRs remained open, and the schedule variable remained `false`.

- Candidate normalization, six identity keys, duplicate rejection, 50/10/3 limits and two-per-ICP cap.
- US/en SERP normalization, paid-provider normalization and observation provenance, bounded polling and actor abort.
- HTTPS source checks, DNS pinning, redirect safety, authoritative-source policies, streaming limits and cancellation.
- Structured generation, independent support critique, one repair and complete repaired-binding verification.
- Markdown/frontmatter serialization, secret rejection, approved media selection and deterministic SVG safety.
- Native validation-report identity, immutable bundle hash, exact base SHA and review-only publication restrictions.
- Incremental queue retention, state conflicts, lease recovery, bounded retries, one-pilot reservation, durable artifact handoff and uncertain-PR reconciliation.
- Separate preparation/publication credentials, disabled schedule, pinned Actions and read-only target inventory.

## End-to-end fixture

The fixture exercises the real Apify and keyword adapters against injected offline responses, the real researcher and source checker, the real drafting/critique/repair flow against a deterministic model transport, durable local state, artifact files, and the real publisher's disposable Git checkout.

It scans 50 candidates, deeply checks the best 10, produces three review bundles with a two-per-ICP cap, and verifies that a restart does not repeat completed work. A separate case proves the one pending-metrics pilot and its prepared/consumed state. Rejection cases produce no article or PR.

The optional native fixture copies the configured lander's `app/lib/articles.ts` unchanged at test time. It runs real offline `npm ci`, a fixture wrapper around that native contract, real ESLint with fixture configuration, and a small React Markdown static build. It does **not** substitute those scripts for a full lander Next.js build.

Set `AUTOBLOG_NATIVE_LANDER_PATH` to explicitly require this test. An unavailable explicit path fails; with no path and no local sibling checkout, the two native cases are explicitly skipped while rejection tests still execute. The Actions workflow installs the private lander's dependencies and explicitly runs the native fixture after the authenticated read-only checkout.

## Full native validation

A generated fixture bundle is separately passed through `autoblog validate`, which clones the selected lander branch into a disposable directory and runs the repository's unmodified `npm ci`, `npm run check:blog`, `npm run lint`, and `npm run build`.

Verified on 2026-09-05 against lander commit `a57ac1410815f077801baa8a31c90ee7c7137959`: locked install, all 32 native blog tests, lint, full Next.js 16.3.1 build, workspace-integrity check and temporary-checkout cleanup passed. The generated bundle SHA-256 was `6d732d2db3e7c5b21a28a3d6f88569dd9e5afce6fd78a44591daf513af627078`.

This check caught and fixed two runtime integration defects: cloning unnecessary history from a partial local checkout, and inheriting/forcing `NODE_ENV` during dependency installation and contract tests. Validation now clones only the configured branch tip and lets the lander's build command select production mode itself.

The fixture bundle and full command report remain in ignored `artifacts/autoblogger/`; they are test data, not an approved pilot or publication-ready article. The generated example is deliberately small and its metrics and URLs are synthetic. No article-quality or live-provider success is inferred from fixture results.

## Operational dependencies

- `APIFY_TOKEN` was securely stored in ICP Actions secrets on 2026-09-05. No value appears in the repository.
- OpenAI is now verified locally; its Actions secret, paid keyword-provider access, scoped lander read credentials and publication App installation remain required for their respective unattended/later steps.
- PR #55 was still open at the 2026-09-05 check. Pre-merge output remains artifact-only.
- The schedule defaults to disabled. Enabling it and reviewing/publishing every generated article remain human decisions.

Independent model critique is probabilistic. The runtime currently supplies checked SERP titles/snippets as evidence, clearly distinguished from full-page facts; a reachable URL alone cannot establish its body content. Human review of source support, usefulness, originality, media suitability and copy remains mandatory.
