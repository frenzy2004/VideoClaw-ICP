# Autoblogger v1 verification

Scope: `automation/persistent-autoblogger-v1` into `VideoClaw-ICP:seo-campaign`.
No lander source changes, article publishing, production merge, deployment or schedule activation are part of this verification. Earlier offline checkpoints and the later authorized live local attempt are distinguished below.

## Latest offline source-planning correction — 2026-09-07

The [source-planning report](SOURCE-PLANNING-FIX-2026-09-07.md) records bounded
source anchors, cumulative source-use accounting, whole-article bounded-repair
instructions and the imperative-object reference correction. These were tested
offline; no further live retry, API spend or article rewrite occurred.

Fresh final full-suite verification: **1,212 tests across 50 files passed** using one
worker, including the unchanged 250-row content-map test (1,350 ms). Repository
lint, typecheck with Next route type generation, build and whitespace checks also
passed. Existing gray-matter direct-eval and vinext mixed-import warnings remain.
No timeout or test assertion was relaxed to address the prior full-suite timeout.

Hash-verified offline replay of the four saved responses still returns blocked:
the reference false positive is fixed, but the independently reviewed source
overuse and recording heading remain. The new ledger counts 845 CloudShare-derived
public words against the unchanged limit of 180. It creates no bundle and cannot
reach native article QA. Saved receipts and persistent state remain byte-identical.

The native parser/fixture-renderer end-to-end test passed as part of the full
suite. It is synthetic evidence, not a full lander build of a fresh live article.

Independent review reproduced and cleared additional defects before integration:
literal FAQ text omitted by Markdown parsing, rendered heading text hiding a
product name, and overly broad imperative reference exemptions. Section headings
now use their actual emitted Markdown context; plain metadata/FAQs retain literal
text. Unknown object heads remain blocked instead of guessing their identity.
Duplicate and zero-overlap anchor suggestions were also removed. The reviewer
reported no remaining Important or Minor findings in this scoped final patch.

## Previous bounded editorial pilot — 2026-09-07

The [live pilot report](EDITORIAL-PILOT-2026-09-07.md) records the separately
approved fourth attempt, fresh research, all four model calls and failed final
review. Description/label/FAQ improvements were observed, but source over-reliance
and an unsupported recording heading still failed independent verification.
A deterministic reference-check disagreement is also retained. **Zero accepted
bundles, native article QA passes or lander PRs** resulted. No review override,
manual rewriting or fifth call occurred.

Independent re-review verified 207 scoped tests with no remaining P1/P2 after
fixing the old-switch reload bypass. The normal cap is unchanged; the separately
authorized extra grant is consumed and terminal attempt-four history is retained.

Final full-suite runs: **1,100 passed / 1 failed**, with the existing 250-row
content-map test timing out unchanged at five seconds. Lint, typecheck and build
passed separately after the live run. No timeout/assertion was loosened. This is
a review checkpoint, not an all-green release or successful article milestone.
The unchanged content-map file passed its isolated rerun (8/8; 250-row case
2,316 ms). That does not replace either failed full-suite result.

## Previous editorial correction — 2026-09-06

The [quality-check report](EDITORIAL-QUALITY-2026-09-06.md) records the
description, repetitive-label and FAQ-selection corrections. Regression tests
reproduced false acceptance before fixes. Deterministic editorial findings now
enter the existing bounded repair even if the model critic approves; unrepaired
findings block bundle creation.

A read-only audit of the saved live response detects its title-only description
and 22 repetitive process labels. Re-selection from the same observed FAQ pool
excludes the launch-checklist question. Receipt hashes and unchanged local state
are verified. No model/research requests, copy rewriting, additional pilot or
lander changes were made. The previous native QA pass below remains historical;
the saved article does not pass the stronger current editorial checks.

Fresh final verification: **1,076 tests across 49 files passed**, followed
sequentially by repository lint, `npm run typecheck` (including Next route
type generation) and build. The 50-candidate offline fixture ran with the
native article parser and its fixture renderer; this is not a full Next build
of a newly generated live article. Existing gray-matter/vinext build warnings
remain. Exact final verification details are in the quality-check report.

## Previous unchanged-draft artifact validation — 2026-09-06

The [artifact report](PRODUCT-DEMO-ARTIFACT-2026-09-06.md) distinguishes the live
worker failure from the subsequent unchanged-response revalidation. The new live
attempt automatically retrieved organic/PAA/source evidence and completed four
GPT-5.5 calls. Final model verification approved all bindings and resolved all
four initial issues. Three deterministic product-reference false positives then
stopped the worker. No article copy or evidence was manually changed.

After reproducing those grammar defects RED and fixing them narrowly, all four
saved responses were replayed offline through the production drafter. The exact
resulting bundle passed the lander's native 32-test blog contract, lint and build
in a disposable checkout of `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.
The original lander and persisted state were checked unchanged. The original
run is still failed; the terminal candidate retains attempt three. No successful
pilot marker, publication envelope or generated lander PR was recorded.

Fresh worker verification: **1,028 tests across 49 files passed** with
`npm test -- --maxWorkers=2`; lint, typecheck, build and whitespace checks passed.
An earlier four-worker run alongside the build timed out in the existing
content-map test; unchanged two-worker reruns passed, with no timeout relaxation.
Existing gray-matter direct-eval and vinext mixed-import build warnings remain.

Independent review found and rechecked a P2 overly broad grammar exemption; the
final version anchors the whole sentence and blocks capability suffixes.
Reviewer verification ran 63 focused tests, all passing, with no remaining P1/P2
reported in scope. Main-agent final offline revalidation and native QA ran after
that tightening and retained the same bundle hash:
`1e2737e160a0c2aa923eb919914393b95b369eab8065039e22a4dbd34942badc`.

This is not a clean uninterrupted end-to-end worker pass, browser/Lighthouse QA
of the new article, or publication approval. Copy quality and metadata limitations
are explicitly recorded in the artifact report. PR #55 and production are untouched.

## Previous product-demo retry — 2026-09-06

The [retry report](PRODUCT-DEMO-RETRY-2026-09-06.md) records a real automatic
research/draft/critique/repair/verification run. Final verification failed two
attribution checks; no new automatic Markdown bundle or native article QA pass
resulted. A reproduced product-reference false positive is fixed, while offline
replay of the unchanged saved responses still blocks on independent review.
The improved attribution prompts have not yet been exercised in another live run.

Fresh verification: **1,007 tests across 49 files passed**, plus lint, typecheck,
build and whitespace checks. This includes one-use retry/history regressions,
ordinary-referent positives and product-context negatives, and production prompt
coverage. Existing build warnings remain. Retry accounting advanced to attempt
two without resetting history; the new approval is consumed and decision terminal.
No production or lander change and no schedule activation occurred.

## Previous collector correction — 2026-09-06

The [collector report](COLLECTOR-FIX-2026-09-06.md) records two controlled
live comparisons and a separate fresh production-research-path verification.
Removing the extra page-language filter changed the product-demo query from zero
to eight organic results in both comparisons. The subsequent normal researcher
collected eight organic results, three relevant FAQs and four verified source
bodies; its drafting-input contract and manual-pilot evidence eligibility passed.
No model call, worker reservation or generated article was made. All retained
state and previous failures remain unchanged.

Three regression assertions failed before the two input corrections and passed
afterwards. Fresh full verification: **986 tests passed across 49 files** with
`npm test -- --maxWorkers=4`; lint, typecheck, build and whitespace checks passed.
The existing gray-matter direct-eval and vinext mixed-import warnings remain.
Scoped independent review found no P1/P2. The correction changes neither retry
authorization nor publication behavior; completing a live article still requires
the separate bounded attempt through drafting/review and native lander QA.

## Previous alternative-topic pilot — 2026-09-06

The [alternative-pilot report](ALTERNATIVE-PILOT-2026-09-06.md) records the
five-topic diagnostic, selection evidence and actual one-use worker execution.
The live run failed after two empty organic responses: **zero model calls,
articles, native generated-article QA passes or lander PRs**. The selected topic's
earlier qualifying snapshot was not substituted into the failed run.

Final software verification: **986 tests passed across 49 files** with
`npm test -- --maxWorkers=4`; repository typecheck, lint, build and whitespace
checks passed. An initial default-parallel run timed out in the existing
250-row content-map test (985 passed). That test passed unchanged in isolation
and in the full four-worker run; no timeout or assertion was loosened. Existing
gray-matter direct-eval and vinext mixed-import build warnings remain.

Regressions cover bounded empty-organic retries with exact provenance, unchanged
old-grant history, single-candidate/run target switching, the complete pilot
lifecycle, stale transient-backlog reconciliation, and accurate terminal failure
reporting. The final five failure-classification cases were observed RED before
the correction and GREEN afterwards. Independent review found and rechecked the
old backlog collision; no remaining P1/P2 was reported in the scoped code review.

Actual-state queue/reservation checks ran in memory before the live attempt.
Afterwards, an audited compare-and-swap changed only the new failed candidate's
derived retry classification to terminal at attempt one and added a correction
record. Old grant/run/decision/failure history and the original failed report are
retained. No second pilot or model call was made. Both runtime credential values
and secret patterns were checked against the proposed diff and new report without
printing them. Private state and diagnostic outputs remain ignored.

Lander HEAD remained clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`;
PR #55 was open/unmerged and `AUTOBLOG_SCHEDULE_ENABLED=false` on fresh checks.

## Previous one-use retry approval — 2026-09-06

The [approved-retry report](APPROVED-RETRY-2026-09-06.md) records the current
checkpoint. An explicit additional manual attempt preserves the normal cap and
earlier failures. It remains unconsumed because fresh exact-query and related-query
diagnostics found no qualifying PAA evidence. No new model call, automatic article,
native generated-bundle QA pass or lander write is claimed.

Fresh verification: **921 tests across 49 files passed**, along with lint,
typecheck, build and whitespace checks. Regression coverage includes restart-safe
unused approvals and preservation of required audit history at compaction limits.
The runtime-credential leak check passed. Existing build warnings remain.
Real grant-only persistence and reload passed without reserving attempt four;
all prior run/failure/decision/projection history was checked unchanged. Final
independent review found no outstanding P1/P2 findings in this scoped patch.

## Previous automatic-pipeline fixes — 2026-09-06

The [automatic-pipeline report](AUTOMATED-PIPELINE-2026-09-06.md) records this
earlier checkpoint. **836 tests across 49 files passed.** Automatic PAA recovery and body
retrieval are demonstrated with exact provenance. Live attempt 2 completed four
model calls but failed final draft checks. Attempt 3 passed automatic research but
failed before OpenAI on source format controls. That mismatch is now fixed, and a
fresh four-page/35-fact recheck passes the draft-input contract without altering
state or making model calls. The source/input check is not a full article pass.

No newly automatic live article reached native QA. The candidate remains terminal
at three attempts; no retry reset or manual copy/evidence substitution occurred.
The older assisted artifact below is historical and does not satisfy this milestone.

## Historical assisted local review — 2026-09-06

The [assisted-review report](ASSISTED-REVIEW-2026-09-06.md) supersedes the zero-generation status below. One actual four-call GPT-5.5 drafting/critique/repair run completed, but did not pass final review. An explicitly recorded operator revision produced a real review article using separately attributed Apify, browser PAA and body-source evidence. This is not an unattended worker success.

Native validation and browser QA are recorded with the artifact in that report. Browser checks caught duplicate Sources rendering and clipped, off-brand graphic text despite an initially passing native build; those defects are corrected in the worker, not by modifying the lander. All original PR #55 source remains untouched.

Final worker verification: **668 tests / 45 files**, lint, typecheck and build passed. The actual assisted bundle passed the lander's 32 native tests, lint and full build in a disposable checkout; a separate preview-mode build prerendered all four local guide routes. Local HTTP and 1280px/390px browser checks passed. Bundle hash: `a7f47aef4bfd025cf84e6020da1251c8cadf75f2437a99db0325e5ac569b238e`. Existing gray-matter/vinext build warnings remain. No production, indexing, schedule activation or autonomous-success claim is included.

## Research recovery checkpoint — 2026-09-06

The [recovery report](RESEARCH-RECOVERY-2026-09-06.md) records 80 checked source URLs and 36 distinct query probes (43 SERP observations including repeats). No qualifying evidence bundle, live article-generation run or new article preview resulted. All five new Apify jobs were confirmed terminal; reported usage totals approximately $0.13, excluding OpenAI. Three synthetic, token-limited `gpt-5.5` calls verified acceptance of the actual generation/critique/repair schemas; intentionally incomplete outputs are not successful article evidence.

Repairs: campaign-balanced queue order, evidence screening before the deep-check cap with bounded retries for insufficient data, and provider-compatible critique schemas retaining runtime approval invariants. Regression tests were reproduced red before fixes. The full offline fixture initially caught an old-order expectation; it now asserts the explicit fair order and retains exact 50-candidate coverage.

Fresh final verification: **615 tests passed across 44 files**; repository lint, typecheck, build and whitespace checks passed. The native offline fixture ran, including its generated-artifact validation. This is not a full native build of a new live article, because none qualified. Existing gray-matter direct-eval and vinext mixed-import build warnings remain. A secret-pattern scan of the proposed tracked diff and new report passed.

Independent review found one additional provider-failure edge case: irrelevant candidates could remain retryable if enrichment failed first. Product relevance now rejects them before the metrics request; new tests cover `run`, `pilot` and `research` while preserving retries for relevant candidates. The reviewer rechecked the fix and all three regressions passed. Independent review of queue/schema changes found no critical or important defects.

Lander source stayed clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`; PR #55 and ICP PR #1 were verified open/unmerged and the schedule variable was `false`. Existing local pilot state was not reset or consumed. No source authority policy, production state, publication capability or recurring activation was changed.

## Historical first live local checkpoint — 2026-09-06

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

Independent model critique is probabilistic. The runtime now supplies automatically
retrieved, bounded body context groups with fetch/hash provenance; titles/snippets
cannot substitute for them. Retrieval verifies origin and content, not the truth of
every publisher claim. Human review of support, usefulness, originality, media and
copy remains mandatory. No successful unattended article outcome is claimed.
