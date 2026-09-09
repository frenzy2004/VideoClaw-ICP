# VideoClaw SEO / AEO / GEO content system

Review-only checkpoint: **10 September 2026**. No production merge, deployment, publishing, indexing submission, or schedule activation is authorized in this work.

![VideoClaw worker, artifact-only pilot, and separate human publication gate](./videoclaw-seo-aeo-geo-content-system-v2.png)

Read the three lanes independently, left to right. There are no return arrows or cross-lane connectors. The raster is the pre-pilot architecture illustration; its credential/status annotations are superseded by the live-pilot results below. The detailed conditions below are the source of truth.

## 1. Persistent worker: research and drafting

Implementation: [VideoClaw-ICP PR #1](https://github.com/frenzy2004/VideoClaw-ICP/pull/1), branch `automation/persistent-autoblogger-v1`, targeting `seo-campaign`.

```text
Balanced queue (up to 50) → evidence screen → up to 10 deep checks → up to 3 drafts → native QA → draft PRs
```

The last step is a future gated mode, not permission to open generated lander PRs now.

| Stage | What happens | Retained evidence |
| --- | --- | --- |
| Candidates | Read the incremental backlog and discover related searches for five ICPs. Deduplicate against state and lander inventory, then round-robin eligible campaigns; a full five-campaign queue gets ten scan slots each. | Candidate identity, campaign, trigger and intent |
| Validation | Recheck US/en Google SERPs through Apify, record organic competitors and suggestion/PAA/related-query signals, and request keyword metrics from a configured provider. | Exact query, locale, actor run, dataset and observation time; metric provenance separately |
| Top 10 | Screen missing organic/suggestion/relevant-PAA/product-fit evidence before using a deep slot. Use four scoped publisher queries plus up to three observed-FAQ queries; share 24 fetch slots. Select at least two distinct pages including an authority, then choose three body-supported FAQs from up to nine topic-relevant observations. FAQ results gain no authority automatically; format/heading overlap is not factual proof. | Source URLs, fetch times/hashes, body/heading boundaries, bounded context, separate support-query provenance, original question pool and final FAQ selection |
| Up to 3 drafts | Body-only anchors guide original composition. Private campaign context comes from the configured ICP. Drafting, independent critique and machine checks share one repair-issue registry. Reviewed source use above the 120-word planning target triggers whole-article repair; final review retains the 180-word ceiling. Maximum two drafts from one ICP. | Source-use ledger, current binding classifications, stable issue IDs, critique result and hashes; Markdown only if accepted |
| Native QA | Select allowlisted product media, generate a deterministic branded SVG and validate in a disposable lander checkout using its own contract, lint and build. | Media attribution and native QA report |
| Draft PRs, later | Only the post-merge, fully credentialed mode can open one draft PR per article. All approval flags remain false. | PR number, artifact hash and outcome |

The 250-opportunity backlog is an input, not a required count or proof of measured demand. Earlier research generated 1,000 candidate queries and retained 250 SERP-observed opportunities; do not describe that as 1,000 demand-validated keywords.

## 2. Current pilot: exactly one artifact, no lander write

```text
Apify + page bodies → three observed FAQs with exact body anchors → draft → critique / one repair → native QA → private artifact → STOP
```

The [semantic preparation checkpoint](../autoblogger/SEMANTIC-FAQ-PROOF-2026-09-10.md)
adds one bounded structured retrieval call, mechanically checked source anchors
and a private receipt. It does not approve answers or waive independent critique.
Maximum five model calls; no automatic publishing. The live attempt passed
preparation/drafting/critique, then failed repair scope/binding checks.

The [field-repair correction](../autoblogger/BOUNDED-REPAIR-PROOF-2026-09-10.md)
preserves immutable content in code and supplies exact numeric allowances.
2,355 tests pass; independent review has no outstanding findings. The latest paid
retained-input diagnostic still failed nine word-growth checks inside edited fields.
No accepted article, final review or native article QA resulted. The full live
milestone remains open; the generator must produce edits within the checked limits.

Previous readiness checks, 2026-09-09 Malaysia date:

```text
Two fresh topic screens → retrieved source bodies → distinct supported FAQs insufficient → STOP
```

The [distinct FAQ report](../autoblogger/DISTINCT-FAQ-READINESS-2026-09-09.md)
records a make/create duplicate-selection fix with qualifier preservation.
2,170 tests, lint, typecheck and worker build pass. Neither topic produced a full
worker attempt, model request, accepted article or native article QA. State is
unchanged; the next blocker is FAQ evidence matching, not local credentials.

Previous software diagnostic, 2026-09-09 Malaysia date:

```text
Saved support SERPs → retain observed creation / types / cost questions
→ fresh body retrieval → three FAQ anchors → draft preflight passes → STOP before model
```

The [support-search recovery report](../autoblogger/SUPPORT-FAQ-RECOVERY-2026-09-09.md)
records this correction and the two review PR links. Support questions retain
their own query/run/time and original position; the search seed is not treated
as a PAA expansion parent. Equivalent cost questions fill one intent slot.
No new paid actor or model request, accepted article or native article QA was
produced. Full live proof and the separate team/access dependencies remain open.

Latest full live attempt, 2026-09-09 Malaysia date:

```text
Fresh US/en research → eight organic results / four questions → four fetched source bodies
→ two comparative FAQ evidence gaps → STOP before generation
```

The [explainer-video attempt](../autoblogger/EXPLAINER-LIVE-PROOF-2026-09-09.md)
made zero OpenAI calls and produced no accepted article or native article QA.
The prior tutorial diagnostic's passing FAQ set did not generalize to this new
topic. The consumed one-use grant and all earlier history are preserved; no
production or schedule action occurred. Full live end-to-end proof is outstanding.

Preceding research diagnostic, 2026-09-09 Malaysia date:

```text
Observed questions → targeted support searches → safe body retrieval
→ three body-supported observed FAQs → draft preflight passes → STOP before paid model
```

The [FAQ discovery/selection correction](../autoblogger/FAQ-DISCOVERY-FIX-2026-09-09.md)
clears the research/preflight gap using one paid search and saved-result replay.
It does not create an accepted article or change the exhausted candidate's retry
permissions. Full generation/critique/repair/native QA proof remains outstanding.

Earlier full live attempt, 2026-09-09 Malaysia date:

```text
Fresh Apify evidence → four fetched sources → two FAQ evidence checks fail → STOP
```

The [paid tutorial-video proof](../autoblogger/FAQ-PAID-PROOF-2026-09-09.md)
made no OpenAI call and produced no accepted article or native QA result.
The remaining blocker is FAQ evidence coverage/matching, not local credentials.
All failed history remains intact. No production or schedule change occurred.

Subsequent [matcher correction](../autoblogger/FAQ-CONTEXT-FIX-2026-09-09.md):
the unchanged saved input now recognises the screen-recording body instructions
using their explicit procedure heading as context. The naming FAQ still lacks
an answer anchor, so replay remains blocked before generation. This is an offline
code correction, not a new live attempt or a successful article.

Preceding software correction, 2026-09-09 Malaysia date:

```text
Retrieve bodies → screen each FAQ → draft → critique with exact locations
→ bounded repair → delta gate → independent review → source-growth gate → native QA
```

The [FAQ/repair correction](../autoblogger/FAQ-REPAIR-FIX-2026-09-09.md) passes
the offline worker fixture and a separate full native fixture validation. It adds
body-answer screening before generation and code-enforced repair limits. No new
live attempt, retry reset, generated lander PR or production action occurred.
Lexical evidence screening is not factual approval; human approval remains required.

Previous live observation, 2026-09-08 Malaysia date:

```text
EVIDENCE-FIRST: Screen → correct generic FAQ matching → recover observed questions → verify source bodies
LIVE: Fresh research → draft → critique → one repair → unsupported claims/source overuse rejected → STOP
```

The [last live report](../autoblogger/CONTEXT-BUDGET-PROOF-2026-09-08.md) records
one video-marketing attempt with eight organic results, three observed topic FAQs,
four automatically retrieved sources and four completed GPT-5.5 calls. Current
context-bound reviews resolved six ordinary-reference ambiguities. Final checks
still rejected three new unsupported assertions and source-use totals of 215/233
versus the unchanged 180-word ceiling. No accepted article or native QA resulted.
The uninterrupted live milestone remains unproven. Worker checks pass **1,850
tests**, lint, typecheck and build. Per-region repair budgets are implemented, not
proven effective at constraining generated copy in that run. The subsequent
offline correction is described above; no additional paid attempt is queued.

The [previous content-repurposing report](../autoblogger/SCREENED-CONTENT-PROOF-2026-09-08.md)
and its original failed state remain unchanged; it was not relabelled as successful.

The preceding [webinar report](../autoblogger/FRESH-WEBINAR-PROOF-2026-09-08.md)
remains a separate research rejection. Its failed first attempt and all older
history are preserved. No production or schedule action occurred.

Previous, separate product-demo checkpoint:

```text
LIVE: Apify + four source bodies → draft → critique → repair → verifier approves → checker false positives → STOP
POST-FIX: Same captured article + same verdict → shared final gates → native lander QA passes → review artifact → STOP
```

The [previous report](../autoblogger/AWAKE-PROOF-2026-09-08.md) records the tenth
authorized live attempt and separate post-fix validation. The automatically
researched and repaired article passed the unmodified lander's **32 blog tests,
lint and build** after correcting five reference-check false positives. The saved
article, source facts and independent verdict were not rewritten; no further
provider call was made. This is **not an uninterrupted live worker success**.
The original failed report/state remains terminal at ten, with no eleventh path.
Software checks pass **1,703 tests**, lint, typecheck and build. The output is a
local review artifact only; unattended access remains a separate dependency.

The historical [ninth-attempt report](../autoblogger/QUALITY-REVALIDATION-2026-09-07.md)
retains the first-request timeout during lid-closed sleep, without a returned
response or known provider-side outcome. That failure has not been relabelled.

The historical [eighth-attempt report](../autoblogger/SCOPE-ALIGNMENT-PILOT-2026-09-07.md)
records working automatic research and substantive Plan/Record/Rehearse coverage.
All four GPT-5.5 stages completed. The repaired article still copied a passage and
derived 221, 214 and 326 words from three pages against the 180-word ceiling. No
accepted Markdown bundle, native article validation or generated PR resulted.

Follow-up offline corrections address false binding errors, promote aggregate
source limits to article-level repair requirements, retain all per-page planning
warnings, and remove duplicated source text from repair targets without dropping
evidence. Their tests did not establish improved live generation. At that checkpoint
the candidate was terminal at eight, with no ninth-attempt path.
Software checks then passed 1,591 tests, lint, typecheck and build. Unchanged-receipt
inspection clears 22 false binding findings, while the genuine copied-passage and
source-use violations remain blocked.

The historical [sixth-attempt report](../autoblogger/SOURCE-DISCOVERY-PILOT-2026-09-07.md)
records eight organic results, three observed FAQs, three retrieved source bodies
and four GPT-5.5 calls. Final review rejected missing recording guidance promised
by the fixed title and two checklist citation details. No accepted Markdown or
live native QA resulted. Subsequent offline fixes improve article-level repair
routing, remove three reference-check false positives and expose all rejection
categories in compact reports. They do not change that failed live outcome. State
was terminal at six at that checkpoint; the separately authorized later attempts
are recorded in the current report above.

The historical [fifth-attempt report](../autoblogger/SOURCE-PLANNED-PILOT-2026-09-07.md)
records fresh organic/PAA/source retrieval and exactly four GPT-5.5 calls. Final
checks rejected a cross-sentence reference, unexpected verification IDs, private
audience-metadata support and 226 source-derived words against a 180-word limit.
No accepted Markdown or native QA pass resulted. The candidate is terminal at
five at that checkpoint, with no sixth-attempt path then. Software checks
passed at that checkpoint; the live article milestone did not.

The subsequent [offline review/repair correction](../autoblogger/REVIEW-REPAIR-FIX-2026-09-07.md)
addresses the reference, issue-ID and private-metadata problems and improves
source selection/allocation. A synthetic bundle passed the native lander contract,
lint and full build in an isolated checkout. There was no new live run or state
reset: these software fixes do not relabel the failed fifth attempt as successful.

The historical [fourth-attempt report](../autoblogger/EDITORIAL-PILOT-2026-09-07.md)
records eight organic results, automatic PAA/source retrieval and four model calls.
Metadata, repetitive labels and FAQ selection improved. Final review still rejected
source over-reliance and a recording heading; a separate product-reference checker
disagreement also remains. No accepted Markdown bundle or native article QA pass
resulted. At that checkpoint the candidate was terminal at four; the separately
authorized fifth test above does not change that failed fourth-run result.

The [offline source-planning fix](../autoblogger/SOURCE-PLANNING-FIX-2026-09-07.md)
now resolves the reference-check disagreement and gives the repair a cumulative
source-use ledger. Saved review classifications account for 845 CloudShare-derived
public words, above the unchanged 180 limit. The unchanged article remains blocked;
no new paid run or native QA pass is claimed. The observations below are historical.

- The first attempt scanned fifty candidates and failed all ten deep checks, generating no article. [Historical pilot report](../autoblogger/LIVE-PILOT-2026-09-06.md). Follow-up collector checks still did not establish the complete automated organic/PAA evidence bundle. [Recovery report](../autoblogger/RESEARCH-RECOVERY-2026-09-06.md).
- A later **assisted local review** combined actual Apify organic results with separately recorded browser PAA and manually checked source bodies. GPT-5.5 completed generation, critique, repair and verification; its final result still failed review. An explicit editorial revision produced one local article, without claiming an unattended pass or consuming a successful-pilot slot. [Current assisted-review report](../autoblogger/ASSISTED-REVIEW-2026-09-06.md).
- **Historical automatic attempt and separate revalidation:** a newly authorized product-demo attempt collected eight organic results, PAA questions and four source bodies, then completed all four model stages. Independent verification approved the repair. Deterministic grammar false positives stopped the live worker; after a test-first fix, offline replay of the same saved responses returned the unchanged review bundle, which passed native blog checks, lint and build. No article rewriting, manual evidence injection or new paid call was used in revalidation. That live run remains failed at attempt three; no successful pilot marker or generated lander PR exists. [Artifact report](../autoblogger/PRODUCT-DEMO-ARTIFACT-2026-09-06.md). The [previous retry](../autoblogger/PRODUCT-DEMO-RETRY-2026-09-06.md) remains a historical failure.
- `KEYWORD_PROVIDER=pending` keeps volume, difficulty and CPC explicitly unknown. Paid metrics do not block this one pilot.
- `LANDER_BASE_REF=seo/founder-video-blog-launch` validates against the unmerged blog contract, not production.
- `APIFY_TOKEN` is present in ICP Actions secrets. `OPENAI_API_KEY` is now stored locally in an ignored environment file and verified against `gpt-5.5`; the scoped lander read token is still absent.
- The read token must be separate and fine-grained, restricted to lander contents:read and pull requests:read. Interactive GitHub access does not establish that the worker credential is installed.
- Local attempts used the existing checkout, fresh GET-only interactive GitHub inventory and ignored local state; no publication backend was supplied. They did not modify remote state or configure unattended Actions. Preserve the failure history and reconcile the separately retained assisted artifact before another pilot.
- Offline fixtures exercise this path but are **not** live generated article evidence.

The repaired research path is linear:

```text
US / English-interface SERP (no page-language filter) → bounded PAA collection → source-body retrieval
→ structured draft → independent critique → one repair → independent recheck → native QA
```

The earlier artifact revalidation, not the latest live result:

```text
Live research → draft → critique → repair → model approval → grammar-check failure (retained)
Saved unchanged responses → corrected checks → native QA passed → REVIEW ARTIFACT ONLY
```

These are sequential observations, not two pilot executions. The second line
made no model calls and changed no state. Technical acceptance does not establish
production copy quality; repetitive labels, a short description and one broader
FAQ remain human-review items.

The subsequent [editorial correction](../autoblogger/EDITORIAL-QUALITY-2026-09-06.md)
now detects those description/label problems in the saved draft and excludes the
adjacent launch-checklist FAQ during observed-question selection. This was tested
without new model/research calls or rewriting the artifact. The old native QA
result remains historical; the old draft is not accepted by the stronger current
worker editorial checks.

Recent PAA reuse retains its original timestamp and separate run/dataset; it never
pretends a missing Google feature appeared in the newest organic run. Local exact
replay receipts remain private and ignored. No retry history was reset.
The one-use retry approval changes only the execution allowance for its exact
manual run. It does not relax source, FAQ, model-review or native-QA gates.

The assisted lane is deliberately separate from the persistent worker:

```text
Apify organic + browser PAA + checked sources → GPT draft/review → operator revision → native QA → LOCAL REVIEW ONLY
```

Its page is `http://127.0.0.1:3002/blog/demo-day-video-checklist` on the operator's computer. It is not a fourth article in PR #55, a lander PR, or production content.

### Apify and DataForSEO are different inputs

Apify remains the research source. Its Google Search actor exposes organic results, related queries and People Also Ask; these describe the search landscape, not monthly search volume or a keyword-difficulty estimate. [Apify actor documentation](https://apify.com/apify/google-search-scraper)

DataForSEO is a possible later metrics integration, not a connected provider in this version. Its [Google Ads search-volume endpoint](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/) and [Labs keyword-difficulty endpoint](https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/) are separate services. The current worker accepts `pending`, `semrush` and `ahrefs`; it does not accept `dataforseo` or turn an Apify token into DataForSEO credentials.

No new metrics adapter is claimed here. A third-party Apify actor would need verified upstream provenance, US scope, date, units and response validation before its metrics could be used. Until then the pilot stays pending and recurring/draft-PR mode remains blocked by the paid-metrics gate.

## 3. Site review and the human release boundary

Site integration: [videoclaw-lander PR #55](https://github.com/INFR-Organisation/videoclaw-lander/pull/55), branch `seo/founder-video-blog-launch`, targeting `main`. It remains open and unmerged.

```text
Three Markdown posts in local /blog review → team copy / source / design approval → future human release
```

The three distinct review topics are:

1. How to make a founder pitch video.
2. A 60-second founder pitch video script.
3. What to do when a live product demo fails.

They use the lander's Markdown renderer, VideoClaw typography and media, `/download` CTAs and per-article metadata. All three remain `status: review` with every approval flag false. Review pages are non-indexable in previews and unavailable in production. Local editorial improvements are not team publication approval.

Human approval, a future status/date change, merge, live-domain checks and search-engine submissions are separate release steps outside this authorization. The worker performs none of them.

## Traceability and state

Every article traces back to campaign, ICP, trigger, intent, keyword, SERP observation, competitor gap and cited sources. Provenance belongs in frontmatter and review reports, not public article prose.

| Location | Contents |
| --- | --- |
| `VideoClaw-ICP` source branch | Worker, research library, tests and diagrams |
| `autoblogger-state`, when Actions runs begin | Compact identities, decisions, run/dataset IDs, provider provenance, hashes, PR outcomes and bounded redacted failures; local pilot history must be reconciled first |
| Ignored local pilot state and reports | This live attempt's decisions, provenance, bounded retries and source/PAA rejection report; not Git-backed |
| Apify datasets | Raw search observations |
| Seven-day workflow artifacts | Proposed Markdown, SVG, validated bundle and QA report |
| `videoclaw-lander` review branch | Three manually reviewed drafts and blog renderer |
| Runtime secrets only | Apify, OpenAI and scoped GitHub/provider credentials; never Git content |

## What is ready, and what is blocked

| Work | Current state | Next dependency |
| --- | --- | --- |
| Article and diagram updates | Original three review guides, older assisted local preview, and new unchanged-response Markdown/SVG review artifact; no production action | Team review; keep each artifact's provenance distinct |
| Worker implementation | PR #1 open; offline and native fixture verification recorded separately | Implementation review |
| Automated local article milestone | Semantic FAQ preparation passed live; the full worker attempt failed repair. Field patch and exact numeric guidance are software-verified, but the latest paid diagnostic fails nine word-growth checks | Correct repair generation within existing allowances, then prove accepted content through native QA. Prior failures and exhausted grants remain unchanged; no automatic retry or reset |
| Unattended Actions pilot | Not configured; no successful unattended article | Scoped read token, OpenAI Actions secret, reconciled state and reviewed worker |
| Paid enrichment | Not connected; Apify research does not invent metrics | Provider access and a tested adapter |
| Generated lander PRs | Not enabled | Merged blog contract, paid metrics, GitHub App and approved rollout |
| Weekly automation | `AUTOBLOG_SCHEDULE_ENABLED=false`; Monday 16:00 UTC schedule is in the PR | Explicit activation approval and workflow on the default branch |
| Production and indexing | Out of scope | Separate team approval and release |

After a future approved release, Search Console impressions/clicks, AI citations and download conversions can guide refreshes and consolidation. This measurement loop is planned, not currently automated.

For commands, permissions and failure behavior, see the [worker runbook](../autoblogger/README.md) and [verification record](../autoblogger/VERIFICATION.md).

## Diagram source

The updated raster uses the built-in ImageGen tool with the previous PNG as an edit reference. [The exact prompt is retained here](./videoclaw-seo-aeo-geo-content-system-v2.prompt.md). The older PNG is preserved; this page embeds v2.
