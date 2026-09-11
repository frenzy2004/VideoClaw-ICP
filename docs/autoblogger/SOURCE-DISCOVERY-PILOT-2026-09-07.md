# Source discovery correction and bounded pilot — 7 September 2026

Scope: worker PR #1, `automation/persistent-autoblogger-v1`, based on `26a9c63`.
No production or original lander changes, generated lander PR, deployment,
publication, or schedule activation is authorized.

## Root cause and correction

The topical-body filter correctly rejected unrelated launch/program guidance,
but fallback source discovery searched only YC and Techstars. That combination
could not reliably find authoritative practical product-demo instructions.

The fallback now searches the exact keyword and one observed relevant PAA question
against a shared, scoped publisher policy: YC, Techstars, TechSmith `/blog/`, and
Descript `/blog/article/`. Vendor editorial guides are first-party practitioner
sources about their own workflows, not independent market data or guarantees.
The same policy is used by production source verification. No page URL or fact is
inserted into a candidate, and no saved evidence is fed into the fresh pilot.

Discovery still uses two US/en desktop first-page queries in one bounded Apify
run. Returned rows must match requested queries and locale; scoped URLs still
undergo DNS/redirect/body checks and topic screening. Support results retain
their own provenance and never increase the target keyword's organic count.
At least two distinct topical sources, including one authority, remain required.

Policy vetting used [Descript's product-demo guide](https://www.descript.com/blog/article/how-to-make-product-demo-video)
and [TechSmith's tutorial guidance](https://www.techsmith.com/blog/how-to-video-examples/).
A separate read-only check through the actual source client retrieved the Descript
body successfully. The TechSmith request did not succeed and was rejected, not
given an exception. These checks did not supply facts to the drafting run.

## Explicit local retry boundary

The user's subsequent “ok fix complete it” authorizes one new, recorded,
artifact-only test following the review/repair and source-discovery fixes.
`--approve-review-repair-retry` records
`user_authorized_after_review_repair_fix` for the exact failed fifth attempt and
the same candidate. All earlier failures and consumed approvals remain intact.

The exception requires the preceding consumed source-planning grant, complete
history, a fresh run ID, and no existing successful pilot/artifact. It is consumed
at reservation and permits only attempt six. It cannot be used by scheduled mode,
substituted with earlier flags, or reused for attempt seven. The ordinary cap of
three is unchanged. No reset or silent retry is permitted.

## Verification and live result

Preflight repository checks passed: 1,380 tests across 51 files, lint, typecheck,
build and whitespace checks. Existing build warnings remain. Tests cover scoped
publisher/path matching, fetched-body relevance, exact support provenance and
the single-use retry lifecycle, including terminal failure after attempt six.

Independent read-only review found no important or critical defects. It passed
378 focused tests and checked discovery boundaries, retry-chain preservation and
state-history compaction. This is scoped review, not a repository security audit.

Live run `review-repair-product-demo-pilot-2026-09-07` **failed**. It ran from
13:39:19 to 13:44:27 UTC and completed four HTTP-200 GPT-5.5 calls: draft,
independent critique, one repair and independent repair verification. Provider
usage totaled 117,542 tokens. There is no accepted Markdown bundle, native QA
for this live article, generated lander PR or successful-pilot marker.

Fresh collection returned eight organic results and 13 question strings. The
selected observed FAQs concern starting a demo, an example, and running a good
demo. Three HTTP-200 source bodies were selected automatically: StartupBricks'
launch checklist, YC's Demo Gorilla company profile, and PayPro Global's GTM guide.
The support search ran with the expanded policy, but this particular live run did
not select the newly allowed vendor guides. Their discovery/body checks are
covered separately; do not claim those pages supplied this article's evidence.

The first independent critique rejected the mismatch between the fixed title's
recording promise and the draft's live-demo emphasis. Final verification correctly
kept that issue unresolved. It also rejected the cited support for integrations
and security-answer details in the checklist. Reference-check false positives on
three ordinary editorial instructions additionally blocked the worker.

All original outcomes are preserved. Reviewed derivation was 75, 60 and 137 words
across the three sources: below the unchanged 180-word ceiling. Source overuse,
missing repair issue IDs and private customer-trigger metadata were not failures
in this attempt. Passing those checks does not override the editorial rejection.

| Observation | Run ID | Dataset ID |
| --- | --- | --- |
| Autocomplete | `cFMrHMYWDYJLsYRex` | `LeFXQaYGcja1LpSBE` |
| Exact organic SERP | `WOEA6cJHjq2M58Iv6` | `AlbYKXfZCg5Ir3pSD` |
| PAA | `uZEtVuphB1qfosLFd` | `2li1BRBpeuSlxaqML` |
| Supporting sources | `KyUjNa7KcEr4ye6UI` | `0YkSTgmFfaqn0QcbI` |

## Offline fixes following that failure

- Bounded whole-sentence grammar distinguishes the object of an editorial
  routing instruction from a software-capability subject. Qualified ordinary
  subjects such as a demo checklist also resolve correctly. Product antecedents,
  software modifiers, appended capabilities and unresolved follow-on pronouns
  still fail their checks. Six failing regressions preceded the correction.
- Unlocalized critique issues now request article-level restructuring and remain
  separate from machine-localized binding targets. The critique and repair are
  explicitly told the candidate title is immutable: repair must deliver supported
  coverage, not propose a title edit outside the output contract. Unresolved scope
  or unsupported claims still fail final verification.
- Compact failure reports now retain distinct finding codes and counts instead
  of letting one quoted span consume the 500-character limit and hide later
  editorial issues. Two failing regressions preceded this change; code syntax,
  summary length and omitted-category reporting are bounded.

Hash-verified inspection of the **unchanged** saved repaired draft now returns no
mechanical reference findings. The saved independent review still rejects the
title scope and bindings 19/21. No receipt was rewritten, no facts injected, no
approval changed, and no additional model call was made. This is offline diagnosis,
not a successful live replay or a newly accepted article.

The retained state has ten runs, 21 failure entries, a terminal sixth attempt,
four historical retry grants plus the consumed current grant, no candidate PR,
no content hash and no successful pilot. State SHA-256 after the live run:
`d4b778b9e39880b9cec288a78c46aa1a809c196bbc7be836b69e15df821b64b7`.
There is no seventh-attempt path. The engineering milestone remains unproven:
automatic research → drafting → critique/repair → native QA must pass on a fresh,
properly authorized live run without manual evidence injection or rewriting.

## Final verification

After the offline fixes, **1,412 tests across 51 files**, lint, typecheck with fresh
route generation, build and whitespace checks passed. Existing gray-matter and
vinext dependency warnings remain; the build is not described as warning-free.

Independent post-run review identified two additional reference edge cases: a
hidden pronoun inside a question topic and an introductory artifact phrase
incorrectly resolving the main clause's subject. Seven negative regressions failed
first; re-review then found two neighboring variants. The structural correction
restores the legacy noun matcher unchanged and recognizes qualified nouns only as
explicit subjects or closed editing-command objects, rather than broadening every
ordinary-noun early return. All reported variants now block; intended qualified
subjects and commands still pass. Final independent review passed 371 content tests
and 20 targeted offline checks, clearing both findings with no new important defects
in scope. That clears the code changes, not the rejected live article.

A separate synthetic bundle again passed the unchanged native lander **32 blog
tests, lint and full Next build** in a disposable checkout at
`b6b0833c78443b44b12bf6d33f05baa7ac8427d3`, including locked dependency installation,
workspace-integrity checks and cleanup. Native fixture compatibility is not live
article acceptance. Its ignored report is
`artifacts/autoblogger/source-discovery-native-qa-2026-09-07/validation-report.json`.

All 13 saved live replay receipts passed hash verification. Actual runtime-key
value checks found no leak in changed files; ignored credentials and raw receipts
are not committed. The original lander remains clean at the same SHA, PR #55 is
open/unmerged, and `AUTOBLOG_SCHEDULE_ENABLED` remains `false`.
