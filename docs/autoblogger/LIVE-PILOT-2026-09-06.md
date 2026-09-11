# Local artifact-only pilot — 6 September 2026 (MYT)

Historical first attempt. The later [research recovery checkpoint](RESEARCH-RECOVERY-2026-09-06.md) records the source audit, balanced queue, schema correction and additional collection checks. Neither attempt produced a qualifying article.

## Outcome

**Live research ran. No article was generated or approved.** The selected ten opportunities did not pass the existing evidence gates. No branch, generated lander PR, production change, deployment, indexing submission or schedule activation occurred.

The OpenAI burner credential is stored in an ignored, permission-600 local environment file. A real `gpt-5.5` structured Responses API preflight completed with HTTP 200 (38 input tokens, 14 output tokens). Article generation, independent critique and repair were **not reached** because research eligibility failed first. The key is not in Git or reports.

## How the local run differed from Actions

- Used the existing clean lander checkout at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`, branch `seo/founder-video-blog-launch`.
- Verified that local HEAD matched the remote review branch. Read fresh article blobs, all open PR article identities and branch reservations using the existing interactive GitHub login with explicit GET-only commands. No token was extracted or substituted for `LANDER_READ_TOKEN`.
- Found three existing articles, three open-PR article identities and 48 branches. PR #55 was open/unmerged. The ICP `autoblogger-state` branch did not exist.
- Used an ignored local state file and exclusive per-attempt lock receipts. Retained prior failure history and candidate attempt counts across bounded retries. Did not reset state to obtain a successful result.
- Supplied no GitHub publication backend; `publicationEnabled` was false and the local publisher's PR method explicitly refused calls.
- Normal Actions authentication requirements are unchanged. Interactive access is **not** proof that an unattended read token or GitHub App is configured. OpenAI was verified locally, not installed into Actions in this session.

Local diagnostic files are under ignored `artifacts/autoblogger/local-pilot-2026-09-06/`. The completed run report is in `retry-seed-only/run-report.json`; compact event/provenance audit is in `retry-seed-only/audit/validation-report.json`. Local data is not backed up by the PR. Preserve and reconcile this local state before any future Actions pilot; do not assume its run history exists on a remote state branch.

## Evidence and counts

| Stage | Observed result |
| --- | --- |
| Available queue after existing-article reconciliation | 247 candidates |
| Candidates scanned | 50, all from the newly-funded-founder campaign due current queue order |
| US/en desktop SERP observations returned | 50; this is not proof of search volume or 50 viable opportunities |
| Paid keyword metrics obtained | 0; all volume/difficulty/CPC values remain provider-pending |
| Top-ten deep checks attempted | 10 |
| Deep checks passing | 0 |
| Source-gate failures | 8: did not establish two reachable sources including a source allowed by the authority policy |
| Relevant-PAA-gate failures | 2: fewer than three relevant questions |
| Eligible candidates / drafts / native bundle validations / PRs | 0 / 0 / 0 / 0 |

The raw worker counter `metricsEnriched: 50` means the pending adapter returned 50 explicit pending records, **not** that measured metrics were acquired. `deepInspected: 0` counts successful inspections; ten were attempted and failed. No full live generation-to-native-build success is claimed.

Source-policy failure is not proof that a topic has no credible sources anywhere. Missing autocomplete or PAA is not proof of zero search demand. These are observations from this batch and this checker; do not extrapolate them to the other four ICPs.

## Apify provenance

Times below are UTC on 5 September; the local run occurred after midnight on 6 September MYT.

| Run | Dataset | Terminal status | Purpose |
| --- | --- | --- | --- |
| `Jg6BLSxp7yIhDOEvc` | `DocGyhFGWikMyIWrL` | ABORTED | First autocomplete start exposed nullable `finishedAt`; stopped the orphaned job |
| `dewmGaytdlDFBlbeR` | `SQkvWjCvjKKtKaazW` | ABORTED | Alphabet-expanded autocomplete exceeded bounded polling; worker stopped it |
| `QgxBrUPyVPAGfsrQD` | `c85lkYNJ5Tlogoorz` | SUCCEEDED | Fifty direct autocomplete seeds; 17:08:40.498–17:09:10.822 |
| `MPVIqX3JSb0qQEgjm` | `srLa7qFbg8VIhSRHr` | SUCCEEDED | Fifty US/en Google SERPs; 17:09:12.506–17:11:09.170 |

All four jobs were verified terminal. Their API-reported `usageTotalUsd` values total approximately $0.64; this is a run-usage snapshot, not a final account bill or inclusive OpenAI cost. Raw SERP data remains in Apify; it is not committed.

## Defects found and corrected

1. Normalize `finishedAt: null` to an absent finish timestamp while keeping the run ID available for polling and abort. Still reject malformed non-null values.
2. Disable A–Z expansion in the bounded shallow scan. Fifty seeds previously expanded into up to 1,350 provider queries; direct suggestions plus SERP/PAA/related-search discovery remain. This matches the actor's documented optional expansion behavior. [Actor input contract](https://apify.com/automation-lab/google-autocomplete-scraper/input-schema)
3. Allow up to 150 polls within a 150-second client deadline, accommodating the server's existing 120-second job bound plus result retrieval. The observed Google run took about 117 seconds; the old 30-poll/60-second defaults could not accommodate it. Server timeout, charge cap, retry caps and abort behavior are unchanged. The completed local pilot used explicitly longer bounded harness timeouts; a clock-controlled regression verifies the corrected defaults without another paid run.

Each correction was reproduced by a failing test before the implementation change. Publication, source, PAA and paid-metrics gates were not weakened.

## Next work, not completed here

1. Review the actual top-ten failures and improve source discovery and candidate selection. Distinguish unreachable pages, a narrow authority allowlist and irrelevant PAA rather than relabeling failed evidence as valid.
2. Examine queue ordering: the first run sampled one ICP, not a balanced cross-ICP shortlist. Any ranking or authority-policy change needs an explicit, tested rationale.
3. Run the one-article artifact pilot only when a candidate satisfies the existing requirements. Keep the unsuccessful run and technical retry history; no pilot article has been consumed.
4. For unattended Actions later, add the scoped read credential and OpenAI secret, review the implementation PR, and reconcile local state. Paid metrics and the publication App remain separate later dependencies. Leave the schedule and production off.
