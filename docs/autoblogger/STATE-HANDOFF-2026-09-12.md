# History-preserving worker handoff

## Result and boundary

The [fresh automated article proof](FRESH-WORKER-PROOF-2026-09-12.md) is complete.
This follow-up removes a software obstacle to continuing ordinary worker runs:
diagnostic-only grants previously kept the worker restricted to the already
completed pilot.

The handoff now retains those grants as immutable history while retiring their
execution authority. It does not grant another pilot, reset attempts, waive
paid keyword metrics, approve copy, enable a schedule, or authorize publication.

## What changed

- An optional versioned retirement marker links the consumed successful pilot,
  its artifact hash and the original diagnostic history.
- Original run records and diagnostic decisions, failures, provenance and
  content hashes are retained through normal compaction.
- New unrelated candidates can enter ordinary research and paid-metric runs.
- Historical candidates and aliases remain excluded, including failures that
  happened before the first scan and therefore never entered the global seen set.
- Newly collected suggestions that rediscover a retired topic are filtered before
  queue persistence, so they cannot strand the unrelated current run.
- Lander inventory reconciliation cannot overwrite retained diagnostic decisions.
- Both local and GitHub state saves reject removing or replacing the stored
  retirement marker, even when the caller supplies the current file version.
- A GitHub update of an existing file must first load that version so continuity
  can be checked; the remote file SHA still protects against concurrent updates.

The extra marker is backward compatible: historical state without one retains
the previous diagnostic restrictions. Retiring a failed or unconsumed pilot is
rejected. The original file is not rewritten when preparing a handoff.

## Verification

Fresh verification: **2,922 tests across 67 files**, zero failures or skips;
lint, typecheck and build passed. Existing Vinext dynamic-import warnings remain.
Independent review found the post-scan rediscovery issue above. Its regression
failed before the fix and passes with the final full suite.

Regression tests cover ordinary worker continuation, pending-metric rejection,
retained-inventory reconciliation, historical aliases, immutable stored markers,
history tampering and compaction. Worker flow tests use controlled external
responses; they are software tests, not another live article proof.

The actual local state was also parsed, retired and compacted without changing
the source. It retains **43 runs, 67 failures and one consumed pilot**. The original
SHA-256 is
`8332cb2bb5de560646b165c9843df6538f61797c97bf05ddcb376aee54f8419d`.

## Offline handoff export

```sh
npm run autoblog:handoff -- --state <existing-state.json> --output <private-artifact-directory>
```

The command creates a unique private directory containing `state.json` and a
compact `handoff-report.json`. It requires a successful consumed pilot, rejects
secret-like data and normalization that would change records, and never writes
the source file. It makes no network calls.

The actual export is retained locally under
`artifacts/autoblogger/state-handoff-2026-09-12/handoff-rQGotE/` (ignored by Git).
It was verified against the unchanged original file:

- Export SHA-256: `95eeeef18b594de2e260d8c8b53d0c04db48416513ef20212e98b8d0c107a046`.
- History seal: `3a393ed09cd4f83923b840458e093623d6d20017d24457c149fef6b4612d4817`.
- Every original field is unchanged; only the retirement marker is added.
- All 43 runs and 67 failures remain; the successful pilot remains consumed.
- The directory is private (0700) and exported files are private (0600).
- The exported state parses, compacts and yields 499 queued opportunities in the
  offline queue check. This count is not new demand validation.

No remote state import or worker dispatch was performed.

## Rollout remains separate

Do not initialize unattended execution from an empty state: that would forget
the consumed pilot and duplicate/retry history. Transfer the validated handoff
state to `autoblogger-state:state.json` only as an explicit reviewed migration,
checking the destination version and reconciling any existing remote history
rather than overwriting it.

Unattended operation still needs scoped lander read access, the selected paid
keyword provider and approval to activate the schedule. Generated article PRs
also need the lander blog launch merged and the least-privilege GitHub App.
Every article remains subject to human approval.

This checkpoint stays in worker PR #1. No lander files, PR #55, production
branches, deployed sites, indexing configuration or schedule settings changed.
