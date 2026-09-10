# Required-answer repair and mixed-span review

Worker PR #1 only. This follow-up corrects defects found in the retained-input
[sentence-repair diagnostic](SENTENCE-REPAIR-PROOF-2026-09-10.md). It does not
replace that failed receipt or claim a full automatic article success.

## Evidence and correction

The previous repair planner assigned zero source-word allowance to required FAQ
answers, even though empty answers are rejected. It also advertised spare capacity
on sources whose reviewed counts cannot grow under the repair policy.

Repair planning now uses the same per-page ceiling as enforcement:
`min(initial reviewed derived words, 120)`. It offers no source-transfer allowance.
It reserves room for the direct answer, each FAQ and required scalar fields before
allocating the remaining allowance to repeated body explanation. Retained supported
contextual words can satisfy part of an answer's length without becoming source
derivation. An impossible reservation is explicitly marked infeasible; that never
raises the ceiling or approves an empty answer. These are composition reservations,
not a claim that a twelve-word answer is necessarily useful or supported.

On the saved draft, the former 199/368/108/64 source totals produce ceilings of
120/120/108/64. All four numeric reservations are feasible; the first two direct
answer allowances are 40 words and their FAQ allowances are nonzero. This is
arithmetic feasibility only, not proof of a compliant model repair.

Independent examination also distinguished two retained caption passages. The
body sentence asserted how many buyers would watch videos and in which conditions;
the cited facts did not establish that premise. The worksheet's caption instruction
was original advice without such a factual premise. Neither the initial blanket
approval nor the final blanket rejection was fully reasoned.

The shared initial/final review instructions now explicitly distinguish recommended
actions from embedded empirical premises and named-source attributions. Mixed spans
containing source paraphrase remain conservatively counted in full. Original advice
does not exempt borrowed recommendations, unsupported causal claims or product claims.
The final reviewer still reassesses every binding independently.

## Software verification

Three new regression cases failed against the original code, then passed after the
fix. Boundary tests cover zero/under/over-budget pages, required-answer reservations,
infeasible reservations and contextual grounding. Existing stale-review, ambiguous
source, shared-page, unsupported-claim and final-gate tests remain in place.

Review found that crediting another source's words as retained could shrink a
shared direct answer to 29 words or erase a FAQ. Both cases first failed their
regression tests. The correction credits only supported original guidance/examples;
another source claim that may also be cut is not guaranteed retained space.

Fresh full checks: **2,457 tests across 58 files**, zero failed or skipped; lint,
typecheck and worker build pass. Existing gray-matter eval and vinext mixed-import
build warnings remain. Machine-readable results are local and ignored at
`artifacts/autoblogger/required-answer-repair-verification-2026-09-10/final-tests.json`.

## Paid diagnostic at `5e39ea1`: stopped on worksheet citation transfer

The three-request-capped diagnostic used two paid requests: fresh critique and one
repair. Both returned HTTP 200 from `gpt-5.5-2026-04-23`. It reused only the original
hash-verified automated research context and generated draft. No historical critic
approval was replayed. The new critic caught the unsupported buyer-viewing premise
before repair, but still rejected the graphic caption action; that ambiguity is
not established as solved by a prompt change.

| Request | Input tokens | Output tokens |
| --- | ---: | ---: |
| Fresh critique | 36,921 | 12,225 |
| Repair | 73,765 | 3,821 |

The full-field worksheet repair reassigned two facts to additional prose at
`/sections/0/markdown`. The existing per-fact growth guard correctly rejected it.
No final verification, native article QA or accepted Markdown resulted. The cap
was not retried. Original state/repositories and receipts were verified unchanged.
Private receipts: `artifacts/autoblogger/required-answer-live-diagnostic-2026-09-10/`.

## Follow-up: code-owned worksheet sentences

The remaining full-field mode was selected solely because of literal underscore
fill-in blanks. The new correction admits them only after the Markdown parser
proves the original field consists entirely of plain-text paragraphs. Classification
substitution never changes source text, word allowances or stored ranges. The
model cannot move sentence citations. Complex Markdown retains its original path;
all delta, content, independent-review and native checks remain unchanged.

The worksheet regression first failed, then passed after correction. Tests cover
retained blank bytes/citations plus horizontal rules, emphasis, lists and quotes.
On the exact failed input all 23 editable fields now use code-owned sentences.
Independent narrow review found no actionable issues.

Fresh follow-up verification passes **2,463 tests across 58 files**, with no skips
or failures, plus lint, typecheck and worker build. Existing dependency warnings
remain. The local report is
`artifacts/autoblogger/worksheet-owned-verification-2026-09-10/tests.json`.

The subsequent diagnostic at `440c087` replayed the exact original draft and the
fresh critique, then used one paid repair request (74,861 input / 3,026 output tokens,
HTTP 200, same model). It stopped at patch validation: two returned array items
packed several words together with underscores. No final review or native QA ran.
Original state and receipts remained unchanged. Its private receipts are retained
at `artifacts/autoblogger/worksheet-owned-live-diagnostic-2026-09-10/`.

## Provider word-contract correction

The provider's non-whitespace pattern permitted underscore compounds that the
local word validator rejects. The generation pattern now excludes underscores,
slashes and hyphens as well as whitespace. A failing boundary test reproduced the
two actual compound-token failures; the correction preserves Unicode letters and
apostrophes. The stricter local validator still applies. No invalid output was
normalized into acceptance and no saved response was rewritten.

Independent narrow review found no actionable issues. Fresh full verification:
**2,464 tests across 58 files**, no failures/skips, passing lint, typecheck and worker
build, with the existing dependency warnings. Local results:
`artifacts/autoblogger/provider-word-contract-2026-09-10/tests.json`.

The next capped diagnostic uses the same exact retained draft/critique, paying for
at most one repair and final verification. Native lander validation can run in a
disposable checkout only after acceptance. Any result remains a component test,
not a fresh full-worker success.

No worker state reset, new retry grant, lander write, generated PR, publication,
deployment or schedule activation is authorized by this test. Failed receipts and
the terminal candidate remain unchanged. API credentials and raw receipts stay out
of Git. The complete automatic research-to-native-QA milestone remains unproven.
