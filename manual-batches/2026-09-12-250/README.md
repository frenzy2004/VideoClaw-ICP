# VideoClaw manual review expansion: target 250

Work in progress on `content/manual-review-batch-250`, based on the existing
fifty-article review branch at `900053a`. Target: **250 total complete articles,
50 per ICP**, comprising the unchanged first fifty and 200 additional drafts.

[Draft PR #3](https://github.com/frenzy2004/VideoClaw-ICP/pull/3) contains this
expansion and is stacked on [the retained first-50 PR #2](https://github.com/frenzy2004/VideoClaw-ICP/pull/2).

See [INDEX.md](INDEX.md) for the current assembled count and direct Markdown
links. Counts are incremental; this document does not claim the target is met.
Only `--final` checks can verify 250 total and 50 per campaign.

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
- `native-contract-report.json`, `content-audit.json`: latest incremental checks,
  with actual counts; they do not certify unwritten articles.
- `source-audit.json`, `source-fallback-checks.json`: transport receipts and
  separately recorded web-reading checks. Failed automatic retrieval stays failed.

## Reproduce local checks

From this repository, run the assembly and content checks with `npx tsx`:

```sh
npx tsx manual-batches/2026-09-12-250/assemble.ts
npx tsx manual-batches/2026-09-12-250/audit-content.ts
npx tsx manual-batches/2026-09-12-250/validate-native.mts /tmp/videoclaw-manual50-REVIEW/lander
```

The native validator requires a disposable clone of the lander review branch,
with dependencies installed and **no Git remotes**. It reads the lander's own
schema and copies content into that clone only. Do not point it at production.
For completion, append `--final` to each command. Then run the clone's native
checks, lint, preview build and local HTTP/browser audits.

Author scratch inputs in `drafts/` are ignored; assembled `articles/` are the
complete deliverable. Do not rerun paid collection merely to inspect this batch.
