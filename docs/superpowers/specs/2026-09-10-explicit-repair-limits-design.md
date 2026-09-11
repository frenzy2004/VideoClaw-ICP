# Explicit repair limits

The retained-input paid patch diagnostic reached the new contract and preserved
immutable bindings, but returned five per-fact word-growth findings and one
unchanged-citation finding. No accepted article or native validation resulted.
Its failed output and original worker history remain immutable.

The existing delta validator correctly enforces numeric per-field/per-fact
allowances, but the patch request supplies only original text and bindings. Give
the model those exact computed constraints instead of requiring it to infer them.

Expose a pure helper in repair-policy.ts returning, for each allowed location:
rendered word limit, nullable description character allowance, aggregate bound-word
limits for each original fact, and existing citation URLs. Reuse rendered() and
boundCoverage(), not another tokenizer. Reject stale/invalid baselines. This is
request guidance only; inspectRepairDelta remains authoritative and unchanged.

Add repairLimits alongside repairFields. Tell the model that an unchanged sentence
must retain its entire original fact set; reducing citations does not reduce
derivation. Clarifying a referent may require shortening other words to stay inside
the explicit per-fact limits. No changed approval, evidence, source-use, repair-count,
model, native QA, state or publishing policy. Worker PR #1 only.
