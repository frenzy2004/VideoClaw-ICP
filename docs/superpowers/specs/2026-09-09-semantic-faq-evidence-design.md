# Semantic FAQ evidence preparation

## Purpose and evidence

Goal: make the existing automatic research → draft → independent critique/one
repair → native QA pipeline work without hand-entered facts or article edits.
Keep production, publishing, schedule activation and exhausted-run history untouched.

The current lexical preflight rejects ordinary equivalent definitions and example
questions, while also having accepted equivalent make/create questions as separate
slots. Adding more topic-specific regular expressions does not establish semantic
support. Removing evidence checks entirely would violate the content contract.

## Selected approach

Add one structured GPT evidence-preparation request before drafting in the normal
worker. It selects exactly three distinct, relevant questions from at most nine
actually observed PAA questions and supplies exact body excerpts/fact identifiers.
It may report insufficient evidence instead. No new facts or rewritten questions.

Code validates schema, immutable-context hash, exact observed question membership,
distinct keys/intents, exact body-only excerpts and source IDs. This is a checked
retrieval proposal, not editorial approval: independent critique still assesses
every generated answer, distinct FAQ intent, copying, product claims and source use.

The normal worker calls optional `prepareEvidence(context)` on its drafter before
`draft(context)`. Production drafter provides it; legacy fixture/direct callers can
still use the existing lexical-only path. Prepared evidence and source receipts
must survive local replay and final publication-origin attribution. A failed
preparation never falls back to an unprepared draft.

Maximum: one preparation, one draft, one critique, one repair, one verification.
Keep `gpt-5.5`, existing output/time bounds and no model fallback. Local audit allows
five requests only when explicitly configured for this path; legacy default stays
four. No retry resets, paid-metrics fabrication or changes to approval flags.

## Evidence contract

Version-one preparation receipt contains a context hash, the actual bounded question
pool and three selections. Each selection has exact question text, an intent label,
and one to three anchors containing a source-fact ID and a 30–600-character exact
body excerpt. The hash covers candidate, observations, original SERP provenance,
source facts/checks, metrics and timestamp, excluding preliminary FAQ selection.
Changing facts, candidate or observations invalidates the receipt. Selected questions
must match the prepared context's FAQ list and retained SERP-question list exactly.

Do not stem tool qualifiers when deduplicating. Do not promote a heading, snippet,
AI search answer, unchecked URL or source-fetch success to body evidence. Quotes in
private planning receipts are never permission to quote them in public prose.

## Acceptance

Unit/integration tests prove valid alternate wording can reach drafting with exact
body evidence; unknown questions, duplicate intents, fabricated/heading-only quotes,
stale receipts and insufficient evidence stop before drafting. Worker and replay
tests prove prepared selection reaches both native bundle and origin attribution.
Five-call audit rejects a sixth request, including after failures.

Full suite, lint, typecheck, worker build, independent review and one normal live
artifact-only worker run are required. A live milestone requires a review-only
Markdown bundle passing the actual lander contract, lint and full build in a
disposable checkout. Fixture or preflight success does not complete that milestone.

This refinement implements the user's active "make it work" goal within the
previously authorized non-production boundaries; it does not activate automation.
