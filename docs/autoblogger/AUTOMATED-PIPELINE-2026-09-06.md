# Automated pipeline verification — 6 September 2026

**Historical checkpoint; see the [approved-retry report](APPROVED-RETRY-2026-09-06.md)
for the latest status. The requested fully automated article milestone has not passed.** Automatic
research and source-body input validation are demonstrated; a live draft that
passes critique, repair and native QA is still unproven. The configured candidate
retry limit was exhausted at this checkpoint, and no history or limit was reset to
force another run. A later explicit one-use approval is recorded separately; fresh
PAA diagnostics, not the original source-input bug, now prevent a qualifying run.

## Scope

This change remains in worker PR #1. The original lander review branch, PR #55,
production, publication approvals and weekly schedule are unchanged. The target is
one review-only Markdown artifact produced without manually supplied source facts,
browser questions or editorial rewriting.

## Repairs

1. **Question collection.** The organic SERP collector can omit Google's dynamic
   PAA component. A dedicated [PAA collector](https://apify.com/santhej/people-also-ask-scraper)
   now supplements missing questions in a bounded batch, with one retry. Questions
   retain their exact query, US/en locale, parent question, observation time and
   actor run/dataset. Related searches are not relabelled as PAA, and AI answer text
   is never used as a verified source fact.
2. **Intermittent observations.** If both attempts remain insufficient, the worker
   automatically checks at most ten recent runs of that actor. Only exact-query,
   US/en observations no more than one hour old may be reused; their original
   timestamps and provenance remain intact. The lookup has a 30-second bound and
   uses Apify's [read-only run inventory](https://docs.apify.com/api/v2/actors-runs-get).
   Organic rankings are still fetched live. This is recent evidence reuse, not a
   claim that Google displayed the same PAA box in the latest SERP.
3. **Source verification.** The worker now retrieves HTML through its existing
   public-address, DNS-pinned, redirect/size/time-limited transport. An inert parser
   excludes scripts, hidden content and page navigation. Selected body passages
   retain exact normalized offsets, final URL, fetch time and response hash. Up to
   four documents supply body-only facts; search snippets can no longer substitute.
   Adjacent paragraphs and qualifications are retained as atomic context groups,
   capped at 2,000 characters each and 8,000 characters per document. Oversized
   groups are omitted whole, not truncated into stronger or misleading claims.
   Format-control-bearing groups are also omitted whole before offset construction;
   runtime validation independently rejects residual controls. This fixes a live
   U+200D joiner mismatch between source extraction and the draft contract.
   When primary evidence is missing, two observed FAQ searches can discover
   supporting pages from YC/Techstars. These have separate provenance and never
   increase the target keyword's ranking-competitor count.
4. **Contextual claim checks.** Ordinary references to a founder's product, script,
   recording or other clearly named referents no longer automatically mean
   VideoClaw. Explicit VideoClaw assertions and unresolved product pronouns remain
   gated by caller-approved claims. Exact bindings and complete support coverage
   are still required.
5. **Bounded repair.** Repair receives each rejected location/span, binding hash,
   issue and cited facts. A separate final critique rechecks every repaired binding.
   Copied-passage diagnostics identify the matching wording and field before repair,
   including graphics. Repair must check every repeated version of a rejected claim
   and regenerate exact bindings from the finalized visible text.
   Defaults are the exact configured `gpt-5.5`, low reasoning, 24,000 output tokens
   and a 240-second request timeout. There is one repair and at most four model
   calls; no model substitution, hidden rewriting or forced approval.

## Local execution boundary

`local-pilot-entry.ts` invokes the real worker with its normal researcher, drafting
client and disposable native-lander validator. It uses fresh GET-only interactive
GitHub inventory, not an extracted broad token or an Actions credential substitute.
It has no publisher capability. The existing failed candidate identity, retry count,
queue and historical run records must survive preflight unchanged except for
reconciling the same candidate's already-retained queue representation.

The local runner also retains exact, hashed replay receipts for automatic research,
the drafting context, model requests and model responses. These are permission-600,
Git-ignored files, never compact state or PR content. Known credentials and
secret-like content cause rejection, not silent redaction of the evidence. Requests
are recorded before dispatch; a failed audit cannot silently consume a model call.
This local diagnostic path does not configure unattended Actions credentials.

```text
Existing candidate and state
  → fresh organic SERP + observed PAA
  → automatic supporting-page retrieval
  → structured draft → independent critique → at most one repair
  → independent recheck → native lander QA
  → review Markdown + SVG + provenance/QA artifacts → STOP
```

## Verification record

| Check | Result |
| --- | --- |
| Final regression suite | 836 tests passed across 49 files, including offline end-to-end/native-contract fixtures |
| Attempt 2: automatic research through four real model calls | Failed final draft validation; no article/native QA pass |
| Attempt 3: automatic research and source retrieval | Passed collection; failed draft-input validation before any model call |
| Fresh source-input recheck after the control-character fix | Four HTTP-200 documents, 35 body facts; fact contract and citation identities passed; zero model calls/retries and state unchanged |
| Full native QA of a newly automated live article | Not reached |
| Generated article PRs, publishing, deployment, schedule activation | None |

Final lint, typecheck and build passed. `check:autoblogger` passed all 610 worker
tests across 29 files and its additional typecheck. The initial sandboxed worker
check could not bind seven loopback HTTP fixtures; the unchanged tests passed with
socket permission. Existing gray-matter direct-eval and vinext mixed-import build
warnings are not claimed as fixed by this patch. Proposed files were checked
against both exact runtime credential values; neither appears in the patch.

### Actual live attempts

Attempt 2, `automated-pilot-2026-09-06-attempt-2`, completed one real draft,
independent critique, bounded repair and independent verification using `gpt-5.5`.
The final output was rejected for copied wording, an overly broad product-reference
check and a graphic/binding mismatch. The report is a failed run, not a draft artifact.

Attempt 3, `automated-pilot-2026-09-06-attempt-3`, retained eight fresh organic
results and automatically recovered nine recent exact-query PAA observations.
Three were selected as FAQs. Four source bodies were fetched automatically. Two
U+200D joiners in one Flowjam group then caused `Invalid source fact input` before
OpenAI dispatch. That defect is now regression-tested and fixed; the failed run
itself was not rewritten or replayed as a success.

| Evidence in attempt 3 | Run | Dataset |
| --- | --- | --- |
| Autocomplete | `aJdOxeBcTNFCEyVEB` | `jhtAfzBh1cxtVc6mE` |
| Fresh US/en organic SERP | `DYwxOZcT038a6bFcj` | `5yuDTogbVWDVcngsH` |
| PAA observations, originally recorded 19:24:52 UTC | `x136OZbb5jc3YDLQL` | `yU6tA9bil544ELeOl` |
| Incomplete fresh PAA attempt 1 | `gQoZX2IIMSfM21FRg` | `nxKIxafVTKU8eLph2` |
| Incomplete fresh PAA attempt 2 | `ynNEcFCVsaNwMk8A7` | `53016cpqpGEGgEm1s` |
| Automatic primary-source discovery | `scY44vLvtDBfiujpl` | `4fBdeaQYMuArPoC80` |

The PAA cache was discovered programmatically from the actor's recent-run inventory;
no run ID, FAQ list or body fact was manually injected into either worker attempt.
Its original observation time was retained, about 49 minutes before attempt 3.

The source-only recheck at 20:19 UTC fetched Flowjam, Courseweave, Vidyard and YC
again using the production source checker. It retained 17, 9, 8 and 1 complete
context groups respectively. Course-specific requirements and promotional claims
still require scrutiny; a successful body fetch is not proof that every assertion
on a publisher's page is true.

The local candidate `vc-c2-001` is terminal at three attempts, with `manualPilot`
still null and no generated content hash or PR. Continuing live generation requires
an explicitly reviewed retry decision that preserves this history. Changing IDs,
decrementing the attempt count, substituting manual evidence or adding an unrecorded
model call would not demonstrate the requested milestone and was not done.

Private diagnostics remain under ignored `artifacts/autoblogger/`: the two named
attempt directories and `automated-fix-2026-09-06`. The final source-only report and
test JSON are in the latter. Exact replay context/model data is not committed.

The earlier assisted artifact and failed attempts remain historical records; they
must not be relabelled as successful automated runs. No live result here establishes
paid keyword demand, team copy approval, indexing or unattended Actions readiness.
