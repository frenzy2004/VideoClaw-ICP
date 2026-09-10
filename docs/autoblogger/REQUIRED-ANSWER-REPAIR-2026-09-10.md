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

## Live diagnostic boundary

The next diagnostic is capped at three paid requests: a fresh critique, one repair
and final verification. It reuses only the original hash-verified automated research
context and generated draft. No historical critic approval is replayed. Native
lander validation runs in a disposable checkout only if the worker accepts the
bundle. A resulting artifact would still be a retained-input component result,
not a fresh full-worker success.

No worker state reset, new retry grant, lander write, generated PR, publication,
deployment or schedule activation is authorized by this test. Failed receipts and
the terminal candidate remain unchanged. API credentials and raw receipts stay out
of Git. The complete automatic research-to-native-QA milestone remains unproven.
