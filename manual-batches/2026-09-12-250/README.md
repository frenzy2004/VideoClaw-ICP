# VideoClaw manual review library: 250 articles

Authored on `content/manual-review-batch-250`, based on the existing
fifty-article review branch at `900053a`: **250 complete Markdown review drafts,
50 per ICP**, comprising the unchanged first fifty and 200 additional drafts.

[Draft PR #3](https://github.com/frenzy2004/VideoClaw-ICP/pull/3) contains this
expansion and is stacked on [the retained first-50 PR #2](https://github.com/frenzy2004/VideoClaw-ICP/pull/2).

See [INDEX.md](INDEX.md) for all 250 direct Markdown links and the campaign counts.
The final assembly/content checks verify 250 total and 50 per campaign. See
[QA.md](QA.md) for the exact native, build and browser verification state.

All articles remain review-only, with every approval false and no publication
date. Search-result observations do not establish demand. Volume, difficulty and
CPC remain provider-pending. No production branch, lander PR, worker retry state,
schedule or deployment is changed.

## Review files

- `topics.json`: 200 additional editorial search hypotheses and distinct jobs.
- `articles/`, `media/`, `editorial-notes/`: completed new Markdown, original
  topic-specific SVGs and compact provenance. Existing product videos/posters
  are reused from the lander's approved asset list, not newly filmed footage.
- `inventory.json`, `INDEX.md`: combined library, retaining the first fifty at
  `../2026-09-12-50/`; retained article and graphic hashes are checked.
- `serp-*.json`: exact US/en query observations from paid Apify runs.
- `native-contract-report.json`, `content-audit.json`, `build-audit.json`,
  `http-audit.json`, `verification-summary.json`: final 250-record checks and
  their exact verification scope.
- `reviews/`: independent first-ten reviews in all five campaigns, additional
  source checks and a correction record. This is sampled independent review,
  not a claim that every article has publication approval.
- `source-audit.json`, `source-fallback-checks.json`: transport receipts and
  separately recorded web-reading checks. Failed automatic retrieval stays failed.

## Reproduce local checks

From a fresh checkout, validate the committed articles with `npx tsx`:

```sh
npx tsx manual-batches/2026-09-12-250/audit-content.ts
npx tsx manual-batches/2026-09-12-250/validate-native.mts /tmp/videoclaw-manual50-REVIEW/lander
```

The native validator requires a disposable clone of the lander review branch,
with dependencies installed and **no Git remotes**. It reads the lander's own
schema and copies content into that clone only. Do not point it at production.
For completion, append `--final` to each command. Then run the clone's native
checks, lint, preview build and local HTTP/browser audits.

The native library rereads/parses the complete collection on each lookup. Do not
run its 250-record production-visibility check concurrently with the static
build on a constrained machine; the combined load produced page-generation
timeouts in the first local attempt. Final build results are recorded in QA.

Author scratch inputs in `drafts/` are ignored; assembled `articles/` are the
complete deliverable and can be edited directly during review. `assemble.ts`
is an authoring-time command requiring those local scratch inputs, not a
fresh-checkout requirement. Do not rerun it after editing the committed article
without updating its input pair; it would regenerate that article. Do not rerun
paid collection merely to inspect this batch.
