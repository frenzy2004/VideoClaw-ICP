# List binding boundary correction

## Actual run outcome

`audio-cleanup-live-proof-2026-09-12` ran on `f7bfa8b` and failed after automatic
research, body-source verification, FAQ preparation, drafting and independent
critique. Repair was not dispatched and native QA did not run. No artifact was
validated and no pull request was opened.

Research retained eight organic results and ten observed PAA questions:

- Google run/dataset: `t2XhS7Oob2aarACve` / `rwvkxjf2dNebw8hVK`
- PAA run/dataset: `9INaSc6qgBT6XHTs2` / `lWlOKLerS8Bw898aY`
- Autocomplete run/dataset: `6qQDPsHdTpNdhE14M` / `ccbnHZi6UgifX7ByF`

State retains **42 runs, 67 failure records, and no consumed successful pilot**.
No candidate was reset or renamed. Raw local receipts remain ignored and private.

## Reproduced cause and correction

Eight bindings copied actual ordered-list markers, for example `1. Save ...`.
The article renderer exposes the sentence without that marker. Exact coverage
reported eight mismatches plus eight missing bindings. The repair policy correctly
refused an invalid baseline; loosening that policy is not the fix.

The pre-review compiler uses the actual document's Markdown AST and exact source
prefix to remove list syntax from binding metadata only. The result must be one
unique complete rendered sentence. It does not infer citations, rewrite prose or
accept a different marker. Duplicate, overlapping, partial, unknown-fact and
product bindings remain rejected. Literal FAQ numbering and escaped/code-block
markers cannot be treated as list syntax.

Original/canonical hashes and affected indices are recorded. Critique receives
the canonical draft and fresh manifests. An old verdict stays stale; no review
hashes are relabeled.

## Verification and limits

- Test-first regression: six valid marker cases and stale-review rejection failed
  before implementation, then passed. Nineteen added cases cover rendering and
  invalid inputs, including two independently reported edge cases reproduced
  test-first: a partial prefix matching a different paragraph, and a complete
  sentence incorrectly treated as overlap. Independent re-review is clear.
- Initial full suite: **2,851 tests across 63 files**, zero failures/skips; lint, typecheck
  and build passed. Existing Vinext dynamic-import warnings remain.
- After both review fixes, the focused drafting/content/repair suite passed
  **839 tests**, including all nineteen added list-boundary tests.
- The production compiler changed saved bindings 20, 22, 24, 26, 29, 32, 34 and 37.
  All sixteen mismatch/missing findings disappeared. Original receipts, prose
  and source-ID arrays were unchanged.
- This is structural verification only. An ordinary-reference check still needs
  current independent review, and source allocation must still pass. The old
  critique is not reused as approval for the changed representation.

No paid request was made for this correction. This is **not** a fresh worker
success, a newly accepted article or native QA of this article.

## Standard execution receipts

Normal worker executions now retain compact records in the configured artifact
directory, not only in the local diagnostic runner. Each execution/event has a
separate path and records its run, phase, input/result hashes and independently
returned review decisions. Source reads record final URL, timestamp and body
hash before selection/admission can reject them. Article prose, raw page contents,
transport headers and credential values are excluded from these records.

Missing or unsafe required records prevent successful execution and further
paid-provider dispatch. GitHub state persistence remains available for failure
history. Original provider exceptions are preserved. Recording never rewrites
the model input, output, source body, editorial verdict or approval state.

Two review findings were reproduced and corrected: Apify's support-search
fallback now checks the same latched integrity failure, and internal source
selection emits per-read metadata outside the unavailable-page catch. Observer
errors propagate instead of silently skipping the page. Tests also cover encoded
credential URLs, path safety, per-execution isolation and response-write failures.

Final combined checks pass **2,881 tests across 64 files**, zero failures/skips,
plus lint, typecheck and build. The focused source/runtime suite passes 241 tests.
Independent re-review of the six implementation/test files found no remaining
actionable issue after the two corrections.
External I/O in these tests is controlled; no live Actions run is claimed.
The existing seven-day Actions artifact retention is unchanged.

The uninterrupted fresh-worker proof and history-preserving state handoff remain
unfinished. These software checks do not consume the pilot or change a failed
run into a success.

## Runtime configuration

Both `APIFY_TOKEN` and `OPENAI_API_KEY` are configured as worker Actions secrets;
only names were inspected. The existing private local OpenAI credential was
transferred without logging its value. No workflow was dispatched.
`AUTOBLOG_SCHEDULE_ENABLED` remains `false`.

Scoped unattended lander access, paid keyword data, rollout approvals and
history-preserving state handoff remain separate requirements. No production,
lander source, PR #55, deployment or publishing changes were made.
