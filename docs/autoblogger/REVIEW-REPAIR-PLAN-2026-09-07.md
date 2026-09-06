# Review-stage repair plan

Scope: the four fixes approved in this conversation, on worker PR #1 only.
Baseline: `bf55435`. The last live run remains failed and its receipts immutable.

- [x] Review-ID contract (`drafting.ts`, `drafting.test.ts`): reproduce the empty
  model-issue list plus deterministic repair targets. Assign machine findings
  stable unique IDs, send the same registry to repair and verification, and
  reject missing/unknown/duplicate evaluations. Recheck all repaired bindings.
- [x] Ordinary references (`content-bundle.ts`, tests): reproduce saved binding 47;
  resolve explicit ordinary editorial antecedents without exempting software
  predicates, product antecedents, or unexplained pronouns.
- [x] Campaign metadata (content contract and drafting): make `customerTrigger`
  caller-owned from the configured ICP, check exact consistency in code, and
  exclude it from source-claim bindings. Public prose and competitor attribution
  still require evidence; the native lander schema stays unchanged.
- [x] Source selection/allocation (`sources.ts`, `source-plan.ts`, tests): reject
  generic format-token overlap as topic proof; select directly relevant bodies
  before drafting. Plan below the existing 180-word per-source ceiling with
  conservative pre-repair accounting. Do not relax the final independent gate.
- [x] Integrate, test saved failure cases offline, independently review, run full
  tests/lint/typecheck/build and native fixture checks, update the same worker PR.

Parallel write boundaries: main owns drafting/orchestration and documentation;
one helper owns content contract/reference checks; one owns source selection and
planning. Each writes failing regressions before implementation. Cross-component
fixtures are integrated by main after the helpers return.

No production, PR #55, publishing, deployment, scheduling, credentials or persisted
retry-state changes. A new live pilot is a separate verification step after these
fixes pass; do not unlock one merely to test unfinished software. Offline replay
must never relabel the previous failed run or edit its facts, copy or verdicts.
