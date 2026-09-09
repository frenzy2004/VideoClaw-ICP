# Support-search FAQ recovery and review handoff

9 September 2026, Malaysia time. Base: `ac312d0`. Scope: worker PR #1 only.

## Current review links

| Pull request | What the team reviews | Release boundary |
| --- | --- | --- |
| [VideoClaw-lander #55](https://github.com/INFR-Organisation/videoclaw-lander/pull/55) | Three Markdown articles, blog rendering, VideoClaw styling and publication controls | Open/unmerged; copy/design approval still required |
| [VideoClaw-ICP #1](https://github.com/frenzy2004/VideoClaw-ICP/pull/1) | Separate research/drafting worker and this evidence-recovery fix | Open/unmerged; no autonomous publishing or active schedule |

These are the two PRs returned by the account's all-state PR listings in the two
repositories. This checkpoint does not modify the lander or authorize either merge.

## What changed

The prior [live explainer attempt](EXPLAINER-LIVE-PROOF-2026-09-09.md) remains
failed. Its support-search dataset already contained relevant cost questions, but
the researcher discarded every support row's PAA field. The FAQ matcher also
misparsed “cost to make/create” and routed explicit video-type questions through
the definition grammar.

The correction:

- Retains safe, topic-relevant questions from exactly requested US/en desktop,
  first-page support rows, using the existing bounded support-search batch.
- Keeps each supplemental question's actual support-query/run/dataset/time,
  separate from the original keyword's organic rankings. Raw provider answers
  are not source facts or retained public metadata.
- Preserves search operators when matching requested queries, the provider's
  reported query spelling and original raw question positions. Empty/duplicate
  entries cannot renumber later questions. No expansion parent is inferred
  merely because the search query itself was a question.
- Passes the expanded observed pool to body retrieval/selection, while retaining
  the existing seven-query, 24-fetch, nine-question selection and 30-observation
  limits. Selected question observations survive the artifact boundary.
- Matches bounded cost and taxonomy assertions only in actual page bodies, with
  full subject qualifiers. Headings, speculative/negative assertions, teasers and
  unsupported superlatives remain blocked.
- Treats equivalent make/create cost wording as one FAQ intent, not two slots.
  AI-qualified and other materially different subjects remain distinct.

## Measured diagnostic result

The corrected researcher replayed the existing successful support dataset
`uqJF3PpR2b2mXDwZI` from run `qT2gnuwJq4iUygKJV`. It fetched supporting page bodies
through the normal safe reader and selected:

1. How can I create an explainer video?
2. What are the different types of explainer videos?
3. How much does it cost to make an explainer video?

All three have body anchors. The type and cost assertions are in the fetched
[PlayPlay explainer guide](https://playplay.com/blog/explainer-video-examples/);
the price statement is attributed to a 2024 study and must not be presented as a
current universal price. Independent editorial review is still required for any
generated copy. No article text was manually supplied or rewritten.

The real drafter passed its preflight and reached the first model boundary,
where the diagnostic deliberately stopped. **This establishes the research and
matching fix for this corpus, not a successful generated article or native QA.**

Actual new paid actors: **0**. Actual OpenAI requests: **0**.
The old failed report and payload were not changed or relabelled as successful.
Private diagnostic receipts remain under
`artifacts/autoblogger/support-faq-recovery-2026-09-09/` and are not committed.

Final post-review receipt: `final-result/validation-report.json`, checked
`2026-09-09T00:53:02.012Z`. Context SHA-256:
`5eee8549be118bebd0ec82ba11a7d0eda09ca62debb781cdc3983c38c21f7f89`.
The original failed-input payload SHA-256 remains
`0cce08527fd2d4acaf9f159479c416f2cec89d4035c0901f888c7f6b49f5f2ba`.
No source fact was manually inserted. The selected cost question is the actual
third PAA entry of the creation-question support SERP, with `parentQuestion: null`.

## Review and verification

Independent review reproduced four P2 findings: prefix-only cost matching,
punctuation-colliding search identities, inferred expansion ancestry and
renumbered PAA positions. Follow-up review caught a hypothetical attribution
that was stripped before qualification checking. All were reproduced in failing
tests, corrected and independently rechecked. Final scoped review reports no
remaining P1/P2 findings; **445 targeted tests pass**.

The complete-predicate correction initially rejected legitimate production-crew,
editing-budget and recording-time evidence. The unchanged source-selection tests
caught that regression; the recognized driver grammar was corrected and those
tests pass. Examples, placeholders, teaser clauses and generic unnamed factors
still do not qualify. This lexical screen remains conservative, not a semantic
truth guarantee or an editorial approval.

Final full verification: **2,160 tests across 55 files pass**, with zero skipped,
using `npm test -- --maxWorkers=2`. Lint, typecheck, worker build and whitespace
checks pass. Two preliminary default-parallel runs exceeded the existing
250-row content-map test's time limit; that unchanged test passes in isolation
and in the bounded full run. No timeout was raised or assertion skipped.
Existing gray-matter direct-eval and vinext mixed-import build warnings remain.
Private-credential, historical-state, unchanged-lander and local-document-link
checks pass. No new generated article exists, so no new live-article native QA
pass is claimed; full-suite native-contract fixtures are separate evidence.

## What is needed now

| Owner | Need | Blocks |
| --- | --- | --- |
| Engineering | Complete a bounded full generation → independent critique/repair → native QA proof after this fix, respecting existing retry permissions | Claiming the worker works end to end |
| Team | Review PR #55's copy/design and PR #1's implementation | Approved integration/release, not local debugging |
| Team + engineering | Scoped lander read access for unattended inventory; hosted runtime-secret configuration | Unattended Actions pilot |
| Team | Least-privilege GitHub App installation with lander contents/PR permissions | Future cross-repository draft PR creation |
| Team + engineering | Confirm the paid keyword provider and connect its credentials | Scaling and scheduled draft-PR mode |

Local OpenAI and Apify credentials already exist; **do not resend them**.
GitHub currently lists only `APIFY_TOKEN` as a repository secret. The hosted
OpenAI secret still needs configuring; this is separate from the working local
credential. Rotate burner credentials before unattended use.

DataForSEO was discussed but is not an implemented adapter. Existing adapters
are `pending`, `semrush` and `ahrefs`. If DataForSEO is selected, its authenticated
adapter must be added and tested; an Apify token is not a substitute. Paid metrics
do not block this local diagnostic or the first three manually reviewed articles.

## Unchanged controls

The local state hash remains
`8511a9c018e40588998f64da424e975d2309251e027ad924390cb11d8454cf89`.
All 19 runs and 32 failures remain intact; no candidate counter, consumed grant or
success marker was reset. The original lander stays on review SHA `b6b0833`, and
`AUTOBLOG_SCHEDULE_ENABLED=false`. No merge, deployment, publishing, indexing
submission, generated lander PR or schedule activation occurred.
