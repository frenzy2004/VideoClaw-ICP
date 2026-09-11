# Fresh end-to-end worker proof

## Result

**One uninterrupted live worker run produced a validated review-only article.**
This is fresh research, generation, independent critique, one automatic repair,
independent repair verification, native lander QA and durable artifact recording.
It is not saved-response replay, a fixture, or an operator-rewritten article.

- Run: `podcast-clips-live-proof-2026-09-12`.
- Worker implementation: `48ed68f1e5da7be62f19c56e7e1ef167cea6da74`.
- Time: 2026-09-11 19:13:51–19:21:50 UTC (12 September in Malaysia), about eight minutes.
- Candidate: original backlog record `vc-c4-011`, GTM/content-repurposing buyer.
- Query: `turn B2B podcast into campaign clips`.
- Result: one validated artifact, zero run failures, zero generated lander PRs.

Inspect the deliverables:

- [Generated Markdown source](proofs/podcast-clips-2026-09-12/turn-podcast-into-social-media-clips.md).
- [Generated branded graphic](proofs/podcast-clips-2026-09-12/turn-podcast-into-social-media-clips.svg).
- [Compact worker report](proofs/podcast-clips-2026-09-12/run-report.json).
- [Verification manifest and hashes](proofs/podcast-clips-2026-09-12/proof-manifest.json).

These are review examples inside the worker repository's documentation, not
articles added to the lander or a public blog. Product video/poster paths belong
to the lander asset inventory and are not copied into this documentation folder.
Markdown and compact report exports are byte-identical to the original artifacts.
The SVG documentation export adds only a terminal newline; both hashes are recorded.

## What actually ran

| Stage | Observed result |
| --- | --- |
| Preflight | Fresh read-only GitHub inventory; original lander checkout clean and at the remote review SHA |
| Research | Eight organic results and four initial Google questions; bounded support searches retained additional observed PAA provenance |
| Source checks | Page bodies retrieved automatically; four selected sources; independent relevance decisions and body hashes retained privately |
| FAQ preparation | Three observed questions paired with source-body evidence before drafting |
| Draft | Structured generation on configured `gpt-5.5`; no manual copy or evidence injection |
| Independent critique | Rejected an unsupported implication about a competitor's audio-to-video capability |
| One repair | Narrowed that FAQ answer using the existing source facts |
| Independent verification | Approved the corrected draft, resolved both review/mechanical findings and returned no new issues |
| Native QA | Actual lander `check:blog` (32 tests), lint and full Next build passed in a disposable checkout; workspace-integrity check and cleanup passed |
| Persistence | Saved Markdown/SVG and report; recorded the run as validated and consumed the one-artifact pilot with the matching bundle hash |

The six completed model requests were source relevance, FAQ evidence, draft,
critique, repair and repair verification. Request/output hashes, response IDs,
returned model identifiers and token usage are listed in the manifest. Raw model
responses, page contents and credential values remain outside Git.

The native lander base was
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3` on
`seo/founder-video-blog-launch`, not production `main`.

## Evidence and publication state

- Google: run `OM7aph3feejZT0oGJ`, dataset `NqXo3JFAHf42DnDmd`.
- Autocomplete: run `RcgcNb6NtIhiJwdd2`, dataset `m0lM3mqIse722tg7r`.
- PAA: run `VTVYeHMRATXb8Hs85`, dataset `qcf1ZRtV5MBE1M4wP`; the report also retains the preceding collection attempt.
- Support searches: run `12XsuLPKNC3OHkS4m`, dataset `Few9A2K7C5Tt9cXCT`.
- Bundle: `0c0b4d51ae15cfef63644b8ad223c7870c4b3752b2c365ea50b4e273da656583`.
- Article status: `review`; copy, factual, legal and visual approvals all `false`.
- No `publishedAt`; CTA is `/download`; three visible FAQs and allowlisted product media.
- Volume, difficulty and CPC remain `provider-pending`. The report's
  `metricsEnriched: 1` means one adapter result was processed; it does **not** mean
  paid metrics were obtained or demand was validated.

State now contains **43 runs and 67 failure records**, preserving the prior 42
runs and all prior failures. No exhausted candidate was reset or renamed. The
successful candidate was an unused existing backlog topic, at attempt one.
The one artifact-only pilot is consumed; do not launch another free pilot or
strip its reservation to continue testing.

## Verification and remaining work

Fresh worker checks: **2,881 tests across 64 files**, zero failures/skips, plus
lint, typecheck and build passed. Existing Vinext dynamic-import warnings remain.
The artifact check parsed the persistent state, verified the consumed reservation
against native QA's bundle hash, checked review-only frontmatter, checked export
hashes and secret patterns, and verified the six completed model receipts.

This proves the local automated article milestone. It does not prove batch
throughput, unattended Actions operation, paid keyword selection, human editorial
approval, generated lander PRs or production publication.

Remaining worker-owned work: history-preserving state handoff into the ordinary
Actions workflow, retiring diagnostic-only controls without losing failures,
retry counts, deduplication identities or the consumed pilot. Scoped unattended
lander access, paid provider credentials, GitHub App installation and rollout
approval remain separate dependencies.

PR #1 remains the only implementation PR changed by this checkpoint. Original
lander files and PR #55 were not edited. No merge, deployment, indexing submission
or schedule activation occurred; `AUTOBLOG_SCHEDULE_ENABLED` remains `false`.
