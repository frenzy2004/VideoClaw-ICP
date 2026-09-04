# Task 3 report — Structured drafting, repair, and content bundle

## Implementation

Implemented Task 3 under `lib/autoblogger/` without changing the production lander checkout or recreating its publication validator.

- `openai-responses.ts` implements a dependency-injected native HTTP boundary for `POST https://api.openai.com/v1/responses`. It sends strict Structured Outputs JSON schema requests, disables response storage, defaults to `gpt-5.5`, honors an explicit non-empty `OPENAI_MODEL` override, applies a bounded request timeout, parses only one completed `output_text` result, redacts the supplied API key and recognizable credential patterns from failures, and never retries with another model.
- `content-bundle.ts` owns the versioned worker generation DTO and its matching strict JSON schema. The DTO carries generated description, customer trigger, competitor gap, 40–60-word direct answer, Markdown sections, exactly three FAQ answers, source IDs, claim-to-fact references, and editorial graphic copy. It is not a second lander publication schema.
- `drafting.ts` validates Task 1 `Candidate`, `EvidenceBundle`, and `KeywordMetrics` inputs directly, binds the candidate fingerprint, intent, exact query, `en-US` locale, Apify run/dataset/date provenance, PAA questions, checked final source URLs, source-fact IDs, product-claim fact IDs, and model-bound secret safety before the first model call.
- The drafting flow always performs generation followed by a separate independent critique. Any critic issue or deterministic finding triggers one repair call. There is no second repair or fallback model. A residual deterministic issue or a no-op repair after critic rejection returns a blocking content result without a `DraftBundle`.
- Product claims are caller supplied. Generated references must identify a supplied claim, use only that claim's allowed source-fact IDs, and keep the supporting source visible. Generated VideoClaw prose that does not contain caller-supplied claim text is blocked.
- Transient source excerpts are projected out of every model request and output. They are used only in memory by a deterministic contiguous 12-word copied-passage heuristic across public prose and FAQ content.
- Deterministic content checks reject raw HTML, Markdown H1s, malformed fences/links, secret-like values, internal research/debug boilerplate, unsupported Markdown or raw HTTP(S) URLs, citation/source-inventory mismatches, copied passages, unsupported product claims, and FAQ drift from the three PAA questions.
- `selectProductMedia()` chooses deterministically from structurally valid injected entries only. Entries require an explicit candidate/campaign/keyword mapping, root-relative video and poster paths, positive integer dimensions, and non-empty alt/caption copy. If none matches, drafting returns a blocking 1200x675 media brief before any model call and exposes no `DraftBundle`.
- `materializeDraftBundle()` emits a Task 1 `DraftBundle` with deterministic YAML frontmatter and Markdown. The object uses the lander's current camelCase names, exact candidate/provenance/metric values, `review`, four false approval flags, no `publishedAt`, `/download`, exactly three PAA-grounded FAQs, at least two code-rendered visible sources, selected product video/poster metadata, and an editorial SVG path.
- The generated VideoClaw SVG is deterministic, 1200x675, contains no script, event handler, or external resource, and XML-escapes every generated title, alt, label, and detail value.
- `index.ts` exports the Task 3 public boundaries for later orchestration and publishing tasks.

## RED and GREEN evidence

| Cycle | Observed RED | Observed GREEN |
| --- | --- | --- |
| Responses API and Structured Outputs | `npm test -- lib/autoblogger/openai-responses.test.ts` failed because `./openai-responses` did not exist. | The same focused file passed 3/3 after the single-model Responses adapter was implemented. |
| DTO, safety, media, serialization, and SVG | `npm test -- lib/autoblogger/content-bundle.test.ts` failed because `./content-bundle` did not exist. | The first bundle implementation passed 14/14. |
| Draft/critique/repair orchestration | `npm test -- lib/autoblogger/drafting.test.ts` failed because `./drafting` did not exist. | The initial orchestration implementation passed 4/4. |
| Checked-source/provenance and broader prose safety | The combined content/drafting run had five expected failures: unsupported raw URLs, copied FAQ text, mismatched fingerprint, mismatched query, and unreachable checked-source binding were accepted. | The same two files passed 24/24 after URL/prose scans and context binding were tightened. |
| Structurally unsafe media | The focused test returned a matching remote, zero-width media entry instead of ignoring it. | The content file passed 18/18 after runtime allowlist parsing was added. |
| Secrets in model-bound facts | The focused test made model calls with an `API_KEY=...` source fact. | The drafting file passed 8/8 after preflight secret rejection was added. |
| No-op repair | A critic-rejected draft returned `ready` when the repair response was byte-for-byte structurally unchanged. | The drafting file passed 9/9 after unchanged critic repairs became blocking. |
| Combined Task 3 | `npm test -- lib/autoblogger/openai-responses.test.ts lib/autoblogger/content-bundle.test.ts lib/autoblogger/drafting.test.ts` | 3 files and 29 tests passed before the final no-op repair regression; final repository verification includes all 30 Task 3 tests. |

Tests use hand-written Candidate/EvidenceBundle/KeywordMetrics/checked-source/content fixtures. The HTTP-boundary tests use complete successful and incomplete Responses API-shaped fixtures. No test reads an API key from the environment or performs a live OpenAI, Apify, provider, source, or lander request.

## Verification

The first full verification found one lint warning for an intentionally omitted excerpt destructuring binding. Root-cause review showed that this repository does not exempt underscore-prefixed variables. Replacing the omission binding with an explicit persisted-field projection kept the existing no-excerpt test green and removed the warning.

Final fresh verification command:

```text
npm run typecheck && npm run lint && npm test && git diff --check
```

Results:

- Next route generation and TypeScript completed successfully.
- ESLint completed with zero warnings and zero errors.
- Vitest passed 31 files and 313 tests.
- `git diff --check` completed successfully.
- The production lander worktree remained clean.

## Files changed

- Added `lib/autoblogger/openai-responses.ts` and `openai-responses.test.ts`.
- Added `lib/autoblogger/content-bundle.ts` and `content-bundle.test.ts`.
- Added `lib/autoblogger/drafting.ts` and `drafting.test.ts`.
- Updated `lib/autoblogger/index.ts` with Task 3 exports.
- Added this report.

The pre-existing untracked `package-lock.json` was not modified intentionally, staged, or committed. No dependency was added.

## Self-review

- Confirmed the model DTO is versioned and strict while the materialized article remains an opaque `DraftBundle.article` record under the Task 1 worker envelope.
- Confirmed there is no imported, copied, or independently enforced production article schema. Task 4's temporary-checkout lander validation remains final authority.
- Confirmed all model calls use one configured model and the repair path can make no more than three calls total: draft, critique, repair.
- Confirmed the independent critique cannot waive deterministic safety findings.
- Confirmed missing media blocks before model use and returns no `bundle` property.
- Confirmed code, rather than model output, owns title/slug/canonical path, campaign/ICP/keyword fields, status, approvals, CTA, dates, metrics, source metadata, media dimensions/paths, Markdown headings, visible source list, and SVG dimensions.
- Confirmed pending metrics remain explicit `provider-pending` values and named-provider values are copied without invented replacements.
- Confirmed source URLs in generated prose must match the supplied inventory exactly and cited source IDs resolve to reachable checked final URLs.
- Confirmed product claim references bind only to caller-approved source-fact IDs and unsupported VideoClaw claims are blocked.
- Confirmed transient excerpts do not enter request payloads, frontmatter, Markdown, SVG, blocked findings, or returned bundles.
- Confirmed output cannot set `publishedAt`, change `review`, enable an approval, or redirect the CTA away from `/download` because those fields are code-owned constants.
- Confirmed the production lander checkout was only read and its final `git status --short` was empty.

## Concerns

- Product-claim support is intentionally caller-authoritative: the worker verifies identifier binding and exact allowed claim text, but it cannot make a semantic or legal determination that a supplied fact proves a supplied claim.
- The copied-passage check is a deterministic 12-word contiguous-match heuristic. It is useful for obvious copying but is not a plagiarism or copyright determination and may require tuning with production content.
- The media boundary validates allowlist structure and explicit mapping, not filesystem existence. Task 4 must inject the files into a temporary lander checkout and let the lander's native check verify that the selected video, poster, and generated SVG exist.
- Task 4 must exercise the emitted Markdown/SVG against the lander's native current check before any draft PR; Task 3 deliberately does not claim publication-contract parity on its own.
