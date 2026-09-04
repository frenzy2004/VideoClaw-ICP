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

## Important-review fixes (2026-09-05)

All Important findings from the Task 3 review were addressed in the shared feature worktree. The production lander and production branches were not modified.

### Implementation changes

- Promoted the worker generation contract to strict `GeneratedDraftV2`/`videoclaw_article_draft_v2` and added exact claim bindings: generated location, visible sentence span, one or more source-fact IDs, and a nullable caller-supplied product-claim ID. Objective declarative claims in metadata, direct answers, headings/body, FAQ answers, and editorial SVG copy must have one unique binding. Each binding must resolve to facts belonging to selected visible sources and must have deterministic lexical support from those fact texts. Product claims additionally require exact caller-supplied text and only that claim's allowed facts. Product aliases and ambiguous pronouns are detected independent of a literal `VideoClaw` substring.
- Replaced no-op-only repair checking with structured critic issue IDs and checkable path predicates. A repaired draft is accepted only when every critic predicate was false in the rejected draft, true in the replacement, and all deterministic checks pass. Unchanged or unrelated edits fail closed with the unresolved issue ID. Invalid critic approval/issue combinations and duplicate issue IDs are rejected by the runtime and Structured Outputs contracts.
- Added a final serialized-Markdown inspection pass using the unified/remark parser stack. It parses the actual assembled document body after frontmatter serialization; requires the direct answer to be the first real 40–60-word paragraph; rejects ATX and Setext H1s, raw HTML, block code, reference links/images, autolinks, unsafe schemes, malformed links, and destinations outside normalized selected source URLs. Source labels are structurally Markdown-escaped before rendering.
- Extended final-artifact checks across the assembled frontmatter, Markdown, and SVG. Every generated SVG text field must appear XML-escaped in the fixed 1200x675 script/event/resource-free SVG. Copied-passage comparison runs again after assembly against the transient excerpts, while excerpts remain absent from model requests and returned artifacts.
- Centralized credential detection/redaction in `secrets.ts`. The shared patterns include raw `apify_api_` and `github_pat_` forms plus the existing OpenAI, Stripe-style, GitHub, AWS, assignment, Bearer, and Apikey forms. Generic model context, selected media, generated drafts before critic calls, critic output before repair calls, provider errors, and final artifacts are scanned without placing matched values in errors.
- Normalized checked HTTP(S) final URLs before binding and now require at least two distinct normalized reachable final URLs both at drafting preflight and among selected visible source references.
- Hardened allowlisted media paths against literal, encoded, and nested-encoded dot/traversal segments, separators, empty path segments, and backslashes. Candidate/keyword selectors that normalize to empty text are invalid. Invalid mappings still return the blocking media brief before any model call; selected media with secret-like content is rejected before model use.
- Added strict ISO date-time parsing for `generatedAt` and every source `checkedAt`, including calendar/time validation. UTC date-only values are derived from valid timestamps for `createdAt`, `updatedAt`, and emitted source metadata. Apify `capturedAt` remains the exact validated date-only provenance value.
- Aligned Structured Outputs string constraints with runtime non-whitespace checks and updated the generation/repair prompts to version 2 and explicit objective-claim binding instructions.
- Added direct `remark-parse` and `unified` dependencies because the final artifact now relies on their public APIs. The pre-existing untracked `package-lock.json` was left unstaged and uncommitted as instructed.

### Regression-first evidence

- Repair verification RED: critic objects with issue IDs/predicates were rejected by the old schema, and an unrelated field edit returned `ready`. GREEN: `drafting.test.ts` passed the unchanged and unrelated-repair cases with `critique.unresolved` and the exact issue ID.
- Claim grounding RED: schema-version-2 fixtures and `claimBindings` failed the v1 DTO; an unrelated fact binding was then accepted. GREEN: missing/invalid facts, appended assertions, unrelated-fact bindings, literal and pronoun product claims, metadata claims, and SVG prose claims are all blocked.
- Final artifact RED: nine focused cases accepted Setext H1, code/reference/autolink constructs, unsafe destinations, a quoted direct answer, injected source-label syntax, or copied SVG prose. GREEN: the same structural suite passed, including an added unsafe image destination.
- Secret/media/date/source RED: the combined focused run reported 18 expected failures, including missing centralized secret handling, raw fine-grained GitHub leakage, traversal media, empty selectors, duplicate normalized checked URLs, loose timestamps, unnormalized source dates, and missing final scans. GREEN: all focused Task 3 files passed.
- Outbound-context RED: a generated credential reached the critic request and a critic credential reached the repair request. GREEN: both flows now stop before the next model call and return only generic `content.secret` findings.

Final targeted verification before the repository-wide check:

```text
npm test -- lib/autoblogger/content-bundle.test.ts lib/autoblogger/drafting.test.ts lib/autoblogger/openai-responses.test.ts lib/autoblogger/secrets.test.ts lib/autoblogger/date-time.test.ts
npx eslint lib/autoblogger/content-bundle.ts lib/autoblogger/content-bundle.test.ts lib/autoblogger/drafting.ts lib/autoblogger/drafting.test.ts lib/autoblogger/date-time.ts lib/autoblogger/date-time.test.ts lib/autoblogger/secrets.ts lib/autoblogger/secrets.test.ts lib/autoblogger/http.ts lib/autoblogger/openai-responses.test.ts
git diff --check
```

Result: 5 focused files and 83 tests passed; targeted ESLint and diff checking completed with no output.

Final repository-wide verification command:

```text
npm run typecheck && npm run lint && npm test && git diff --check
```

Result: Next route generation and TypeScript passed; ESLint passed with zero output; Vitest passed 33 files and 366 tests; `git diff --check` passed.

### Residual concerns after fixes

- Generic fact-to-claim support is deliberately deterministic and fail-closed: it requires source visibility, exact spans, valid IDs, and lexical overlap. It is not a semantic entailment or legal-substantiation engine, so the independent critic and later human factual/legal approvals remain necessary.
- The contiguous 12-word copied-passage heuristic remains a guard for obvious copying rather than a plagiarism determination.
- Media existence and final lander publication compatibility remain Task 4 responsibilities in a temporary lander checkout; this worker still does not duplicate the lander's native validator.

## Scoped re-review fixes (second pass, 2026-09-05)

This pass supersedes the earlier predicate-based repair acceptance and lexical-overlap grounding descriptions above. All scoped re-review findings were fixed in the shared feature worktree without modifying the production lander or production branches.

### Implementation changes

- Removed critic-authored acceptance predicates from both the runtime DTO and strict Structured Outputs schema. After the single permitted repair, the worker runs a new independent critique over the complete repaired draft. Readiness now requires both deterministic checks and that second critique to be clean and approved. A rejected second critique returns its structured issue IDs and blocks; there is no path to a second repair.
- Tightened objective-claim discovery across generated metadata, sections, FAQ answers, and SVG-visible text. Product names, caller aliases, ambiguous product pronouns, causal/outcome/comparative language, and measurements require exact bindings, including imperatives, modals, and product-bearing questions. Adjacent assertions without whitespace are split and checked.
- Replaced stem-overlap support with deterministic exact normalized support. A binding span must be an exact visible sentence at its declared generated location, and at least one selected visible source fact's complete approved claim text must normalize either equivalently to the span or as a complete contained sequence. Facts cannot be combined into a loose topical match. Product-bearing spans additionally require exact caller-supplied product-claim text and allowed fact IDs.
- Added runtime SourceFact validation shared by drafting preflight and direct bundle materialization. Source collections require at least two entries; IDs, labels, fact IDs, and approved fact text must be nonblank, single-line, and control-free; facts cannot be empty; source URLs must be HTTP(S), credential-free normalized destinations; and `checkedAt` must be a strict ISO date-time. Invalid inputs fail before model use or serialization without echoing supplied content.
- Hardened final Markdown inspection around the actual parsed AST. The document must contain exactly one final `## Sources` heading followed by exactly one unordered list. Its item count and order must match selected sources, and every item must contain exactly one paragraph with exactly one direct link, one literal text child equal to the expected label, and the expected normalized URL. Source labels now escape all Markdown-significant punctuation, preventing injected emphasis, prose, or links.
- Extended local media decoding to repeat until stable with a six-pass cap. A segment that does not stabilize, decodes to a dot segment, or reveals a slash/backslash is invalid; triple-encoded traversal therefore blocks before any model call.
- Added XML 1.0 code-point validation to every generated SVG-visible title, alt, step label, and detail at DTO parsing and at rendering. Escaping remains mandatory, and XML-invalid controls or lone surrogate code points cannot enter the SVG.

### Regression-first evidence

- Repair re-critique RED: the existing three-call flow returned after repair and had no second-critique request; an unrelated description change could satisfy a critic-authored predicate. GREEN: repaired readiness uses four calls (`draft`, `critique`, one `repair`, second `critique`), a still-rejected issue blocks with its second-critique issue ID, a clean second critique returns ready, and repair request count remains exactly one.
- Grounding RED: imperative/modal outcome claims, pronoun claims, no-space appended assertions, and the reviewer counterexample `Objective advertising claims double conversion.` were accepted or could pass loose term overlap. GREEN: both reviewer examples, aliases/pronouns, modal claims, upper/lowercase appended assertions, product-bearing questions, missing/unknown bindings, and unrelated approved facts are rejected; an exact normalized approved fact and caller product claim is accepted.
- Source/Markdown RED: blank, multiline, and control-bearing labels reached generation or materialization; Markdown-rich labels produced nested AST nodes instead of literal source text. GREEN: SourceFact preflight rejects malformed fields, and a punctuation-rich attempted link/prose injection serializes to exactly the expected link-only source list AST.
- Media/XML RED: triple-encoded traversal selected an allowlist mapping, and XML-invalid controls rendered in each SVG-visible field. GREEN: the mapping is rejected before model use and all four SVG field categories fail rendering/DTO validation.

### Verification

Focused Task 3 verification:

```text
npm test -- lib/autoblogger/content-bundle.test.ts lib/autoblogger/drafting.test.ts
```

Result: 2 files and 91 tests passed.

The first repository verification run passed all 392 tests and ESLint, while TypeScript identified an overly narrow recursive AST type in the new test only. After correcting that type, focused tests passed again and `npm run typecheck` completed successfully. The final fresh repository checks are recorded in the commit handoff.

### Residual concerns after the second pass

- Exact normalized fact containment is intentionally conservative and may reject legitimate paraphrases. That is preferable to accepting unsupported objective copy; callers should supply approved fact text matching the publishable claim they intend to allow.
- The independent critic and later human factual/legal approvals remain necessary for meaning, context, and legal substantiation that deterministic string checks cannot establish.
- Media file existence and the lander's final publication contract remain Task 4 checks in a temporary checkout; Task 3 continues to avoid a duplicate publication validator.

## Final scoped review fixes (third pass, 2026-09-05)

This pass supersedes the second-pass statement that a generic clean second critique is sufficient and clarifies that approved source-fact support now requires full normalized equality, not containment. No lander files or production branches were modified.

### Implementation changes

- Added a dedicated strict `videoclaw_article_repair_verification_v1` response contract. Its request contains the complete original critic issue objects, preserving every available ID, code, message, and repair instruction, plus the repaired draft. Its response contains one explicit resolved/unresolved evaluation per original issue ID and a separate `newIssues` collection.
- Post-repair acceptance now requires exact original-ID coverage, no duplicate or unknown evaluations, every original issue resolved, no new issues, explicit approval, and clean deterministic checks. An omitted issue blocks whether the verifier claims approval or rejection. Unresolved and newly discovered issues retain structured IDs in blocking findings. The flow still makes at most one repair request.
- Expanded claim detection to fail closed for declarative factual sentences and to explicitly cover product aliases/pronouns, all common modal auxiliaries (`can`, `could`, `may`, `might`, `will`, `would`, `shall`, `should`, `must`, and `ought to`), quantitative statements, causal language, comparisons, and outcome language. Only nonfactual imperatives and non-claim fragments without an objective signal remain exempt.
- Replaced approved-fact containment with exact normalized equality between the complete visible sentence/span and one selected SourceFact claim text. A shorter approved fact can no longer substantiate a longer assertion with an appended outcome or guarantee. Product-claim bindings continue to require exact caller-supplied claim text and allowed fact IDs.
- Centralized source-fact/checked-source binding in `content-bundle.ts` and invoke it from both drafting preflight and bundle materialization. Every source-fact URL must be a normalized reachable checked final URL corresponding to evidence with matching authority; at least two distinct final URLs are required. Materialization separately confirms that its selected visible source set contains distinct checked final URLs exactly matching the selected source records.
- Removed `materializeDraftBundle()` and its validation helpers from the `lib/autoblogger/index.ts` public barrel. Its direct module export remains only for internal cross-file composition and direct regression tests, with defense-in-depth SourceFact validation, checked-source validation, DTO inspection, final Markdown/SVG inspection, and copied-passage/secret scans.
- Materialization now reparses the supplied product media through `AllowlistedProductMediaSchema` before copying any field. Traversal, repeatedly encoded dot segments, malformed selectors, dimensions, and labels therefore cannot bypass the normal selection guard through a direct module call.
- Added Unicode category `Cf` rejection to source identifiers/labels/fact text, media alt/caption labels, generated SVG-visible title/alt/step text, and direct SVG rendering. Existing ASCII/C0/C1 line/control and XML-code-point restrictions remain in force.

### Regression-first evidence

- Repair-accounting RED: a one-issue initial critique followed by an approving verifier with no issue evaluation returned `ready`. GREEN: both approving and rejecting forgetful verifiers block with `critique.verification_incomplete` and the omitted stable issue ID; a complete clean evaluation returns ready; unresolved and new issues block; request history proves exactly one repair.
- Claim detection RED: eight standalone modal variants of `A backup recording can protect the pitch.` were accepted, and a longer guarantee passed when bound to a shorter contained fact. GREEN: all modal variants require binding, the shorter-fact bypass is rejected, an ordinary factual outcome without a keyword fails closed, and a genuinely nonfactual imperative remains exempt.
- Materialization/Unicode RED: direct materialization serialized an unreachable source, traversal/encoded-traversal media, and zero-width media; category-Cf controls survived in source labels, media captions, and SVG titles. GREEN: all of those fixtures are rejected at the relevant preflight/materialization/render boundary.

### Verification

Focused Task 3 command:

```text
npm test -- lib/autoblogger/content-bundle.test.ts lib/autoblogger/drafting.test.ts
```

Result: 2 files and 112 tests passed.

Repository-wide test command:

```text
npm test
```

Result: 33 files and 413 tests passed. Final TypeScript, ESLint, diff, staged-diff, branch-state, and lander-state checks are recorded in the commit handoff.

### Residual concerns after the third pass

- Exact normalized claim/fact equality intentionally rejects paraphrases and combined claims. Approved SourceFact text must be authored at the complete sentence granularity intended for publication.
- Factual-sentence detection is deliberately conservative; uncommon imperative openings may require an explicit approved fact rather than being treated as editorial direction.
- The verifier is still a model judgment, but it can no longer silently forget an original issue: deterministic ID accounting, new-issue reporting, and the human review-state approvals remain separate gates.
- Media existence and final lander-native publication validation remain Task 4 responsibilities.
