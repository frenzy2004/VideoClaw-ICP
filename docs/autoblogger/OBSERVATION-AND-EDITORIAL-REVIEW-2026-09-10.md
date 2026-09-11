# Observation admission and whole-article review

## Boundary correction

Collection is not semantic approval. The software-selection attempt collected real Google questions about recording and using testimonial videos, but its lexical FAQ gate discarded them because they did not repeat the entire commercial keyword. In support dataset `OioNXeH8jlSFmFhA7`, the US/en query `What is the best video testimonial software?` returned `How do I record video testimonials?` and three other testimonial questions. These are observed question strings, not measured demand or approved article answers.

The strong lexical matcher remains a bounded collection-expansion hint. Deep inspection now preserves safe, distinct observed candidates, prioritizes them without rewriting them, and retrieves supporting page bodies. The existing structured FAQ preparer evaluates up to nine candidates against the article's intent and ICP, selecting exactly three with exact body excerpts or refusing the article. The independent critic still checks relevance, distinctness and support. Collection alone cannot authorize drafting or publication.

Article-mode worker runs now require evidence preparation before reserving a candidate or spending on providers. Unknown, duplicate or unsafe preliminary questions fail before preparation. Research-only mode can retain provisional observations without claiming a publishable opportunity. Observation receipts for all nine candidates are prioritized within the unchanged 30-record cap so later semantic selection does not lose provenance.

## Editorial correction

The saved template article passed claim-level review but still contained conflicting instructions, disconnected troubleshooting commands and evaluator-facing commentary. Its native build success was not editorial approval.

Both existing independent review calls now require explicit, current-draft-hash-bound judgments and rationales for:

- Instruction consistency across sections, worksheets and examples.
- Whether each section provides the practical help its heading promises.
- Reader-facing prose, while retaining necessary attribution and hypothetical labels.

Final verification receives code-computed before/after public fields as untrusted comparison data, not prior approvals. Missing, stale or negative editorial reviews cannot be treated as acceptance. Repair remains a single bounded pass and cannot infer edit locations, invent evidence or raise source-use ceilings.

## Verification and live proof

Verification: **2,554 tests across 58 files pass**, with zero failures or skips; lint, typecheck and worker build pass. The existing dependency bundling warnings remain. This includes 212 research/worker tests, the observation-cap provenance regressions, and required editorial-receipt consumer cases. Tests prove enforcement, not the quality of a live model's judgments. No saved artifact or failed history was rewritten.

Independent review found an earlier scan-stage truncation that could discard the receipts for nonliteral questions before inspection. A scan-through-inspect regression reproduced the loss, then passed after prioritizing the nine-candidate pool before that cap as well. The two PAA-attempt and 30-observation limits are unchanged.

The next selected query is `how do i record video testimonials`, observed in the dataset above. It targets the recording/setup task, distinct from the failed software-selection, examples, question-list and template tasks. Its candidate ID is `vc-c4-d-55e408ebd609a1d2`; the standard duplicate checks passed against the local backlog and retained state. The live runner will repeat the exact-query research and source retrieval; no prior facts or drafted prose will be injected.

Before the fresh attempt, retained state has 24 runs, 40 failure records, no active pilot and SHA-256 `4de5a23d222f141e292da968be40934fcaa5caaa99ce13a1928afd56d30ae885`. The lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3` on `seo/founder-video-blog-launch`.

## Unchanged release boundary

Work belongs only to [worker PR #1](https://github.com/frenzy2004/VideoClaw-ICP/pull/1). Local outputs remain review-only artifacts. No lander PR, production changes, publishing, deployment, indexing or schedule activation is authorized by these checks. Paid keyword metrics are still unavailable; no volume, difficulty or CPC is inferred from a SERP scrape.

## Fresh recording run — failed at source selection

`testimonial-recording-live-proof-2026-09-10` ran the committed `5886f9b` implementation with fresh provider requests. It collected seven organic results and ten observed Google questions, entered one deep inspection, then failed to establish two directly relevant usable body sources including an approved authority. It made no OpenAI request, generated no draft and performed no native article validation or publication.

Exact live provenance:

| Collection | Run | Dataset |
| --- | --- | --- |
| Autocomplete | `bfyrSpVvFBXxx4fWn` | `a7neExJpI1S8a7gdn` |
| Exact US/en SERP | `21WdcktfLl7l19eCi` | `ZlfAky3wsbhp5xs8V` |
| First PAA attempt | `wrgk3HpJPj03rJLsv` | `OOVGzv8VKTUI8Xi3T` |
| Second PAA attempt | `xWae35e2djjnmOrc0` | `JUKZnE8LagXk49alx` |
| Support search | `URT33JQfNgkEze0Fb` | `hTz6ex2ycLgLL07zp` |

The receipt is retained under ignored `artifacts/autoblogger/testimonial-recording-live-proof-2026-09-10/`. State after this attempt has 25 runs, 42 failure records, no active pilot, and SHA-256 `998c3c899eeb8d763051f8e89806d96bac69f4d1a6bf09e8ea5e0b3213547047`.

A separate read-only diagnostic replayed these saved provider results through automatic page retrieval without model calls, actor starts or state writes. The reachable approved sources provided adjacent marketing guidance rather than direct testimonial-recording instructions. Other fetches failed; a subsequent production-checker probe confirmed HTTP 403 for both TechSmith testimonial URLs. Temporary DNS failures also affected later requests. Independent review found no evidence justifying a source-gate relaxation or an extraction patch from the retained material. Some non-authority content was contextually useful; this does not satisfy the authoritative-source requirement.

The subsequent candidate, `video editing workflow`, is an unvalidated seed for the C4 buyer task of standardizing an AI video workflow with human review. It is not asserted to have paid demand metrics or to have been discovered in the recording dataset. The fresh runner must obtain its own exact-query evidence and supporting bodies; prior article facts and prose are not inputs.

## Editing-workflow attempt and identified-reader fix

`video-editing-workflow-live-proof-2026-09-10` also failed at source selection before OpenAI or drafting. It collected eight organic results and ten Google questions. Exact SERP run/dataset: `M0x23yumlWK7LE1tZ` / `ZqJRPJPqcdnaaHxSr`; support run/dataset: `vwS1gvPeUwRsGNRUy` / `EWDFQrnfZLHgi1K15`. Its history remains failed at attempt one. State is now 26 runs / 44 failure records, no active pilot, SHA-256 `6dd9f7f5893b9e6149695cfe3f3adcb6ab9e71384d0be48b45a23e7ca6b0691e`.

The later retrieval investigation identified a concrete interoperability defect: source requests sent no User-Agent. Two live A/B probes of the same TechSmith editing-workflow URL returned 403 for the unidentified request and 200 with an honest `VideoClawResearch/1.0 (+https://videoclaw.com)` User-Agent and `en-US,en;q=0.9` language preference. A generic browser identity did not solve it and is not used.

The source reader now sends those two fixed public headers on every request, including redirects. It does not rotate identities, attach credentials, change authority policies, raise limits, bypass failed responses or relax body relevance. Tests first reproduced both failed `check`/`read` paths, then passed with the identification fix. A third test confirms a remaining 403 is rejected after one request.

The unwrapped production reader subsequently fetched `https://www.techsmith.com/blog/video-editing-workflow/` and `https://www.techsmith.com/blog/how-to-edit-a-video/` with HTTP 200. It extracted 12 / 10 passages (7,810 / 7,970 characters), respectively; each scored 2 under the unchanged source-topic screen. This is live retrieval proof, not an article approval or a successful historical worker run.

Latest verification: **2,557 tests across 58 files pass**, zero failures/skips; lint, typecheck and build pass. Scoped independent review found no actionable issue in the header change. The next diagnostic may reuse saved SERP observations and retrieve source bodies afresh without altering persistent worker state; it must be reported separately from uninterrupted fresh-worker proof.

## Source retrieval through new generation — component diagnostic

`editing-workflow-component-2026-09-10` replayed the exact saved SERP queries through the real researcher and retrieved page bodies afresh. No actor was started and no manual source facts were supplied. Automatic selection retained four relevant documents, including two TechSmith authorities. FAQ preparation, a new GPT-5.5 article generation and an independent critique each returned HTTP 200.

The draft was correctly blocked before repair or native QA. Six troubleshooting paragraphs and one FAQ contained two rendered sentences in a single citation record. Coverage checks require sentence-level records, and the bounded repair correctly refused that invalid baseline. Three source-use overages were also present. The model's positive critique did not override those checks. The failed worker attempt remains failed; this diagnostic did not mutate state.

## Exact citation-metadata compilation

The compiler now splits a combined record only when its text is an exact, unique, contiguous sequence of complete rendered sentences at one canonical location. It uses the existing Markdown coverage parser. It preserves every authored character and the ordered source-fact IDs; partial, ambiguous, overlapping, reordered, unknown-fact and product-assertion records remain unchanged and fail existing checks. Schema limits still apply.

Compilation happens before independent critique. The request carries the new sentence manifest, current editorial hash, original/parsed/canonical draft hashes and the split indices. An old verdict cannot approve the resulting records. The existing redundant-FAQ-heading normalization remains in the auditable chain. No repair pass, model-call allowance, evidence requirement or source-use ceiling was added.

An independent editorial read also identified an approval checkpoint used by the worked example but not established in the main instructions. The review instruction now explicitly traces prerequisites, order, ownership and locked states across instructions and examples. That instruction is not itself evidence of article quality; the fresh reviewer must assess the actual copy.

`compound-binding-component-2026-09-10` is the bounded diagnostic for this correction: it reuses the unedited original generation, then requests a fresh critique, at most one repair and a fresh final verification. It may run native QA only after all content gates pass. Its receipts must remain labeled **saved-generation component diagnostic**, never an uninterrupted fresh worker run.

The new critique reviewed all 65 canonical sentence records and rejected the original copy for both the undefined picture-lock gate and inconsistent AI/fine-cut order. The one bounded repair returned HTTP 200 and reached fresh final verification. This proves the new metadata reaches an independent semantic review and the repair path; it does not yet prove final acceptance.

Independent code review found two edge cases: numeric location aliases could evade overlap detection, and a separate complete `Review` label could be mistaken for a substring overlap. Both now have consumer regressions and fixes. The reviewer reran the original reproductions and confirmed closure. Public text is unchanged by normalization, stale reviews remain invalid, and partial bindings still fail closed.

Current full-suite JSON receipt reports **2,583 / 2,583 passing tests**, no failures or pending tests; lint, typecheck and build pass. An earlier concurrent full-suite run reported one failure in its truncated output; the subsequent isolated run passed without a test-policy change. No diagnosis of that transient result is claimed. The saved-generation test remains an explicit local diagnostic, not an optional CI test dependent on private files. Runtime secrets are absent from the diff.

## Bounded component result — source-use rejection retained

The final verifier returned HTTP 200 and accepted all three editorial criteria with no new issues. A separate editorial read, performed without viewing that verdict, found no blocking copy issue; it suggested clarifying the narration stage as a nonblocking improvement. Neither judgment is publication approval.

Code still rejected the repaired draft. Reviewed source-derived counts were 166 words for the Lucidlink workflow page, 153 for the TechSmith collaboration page and 259 for the TechSmith workflow page. Repair ceilings were respectively 120, 72 and 120; the last page also exceeded the 180-word final ceiling. Eight unchanged bindings changed from `original_guidance` in the initial review to `source_claim` in final review. Their wording combined or condensed source procedures, so the stricter judgment cannot be waived merely because the earlier critic used a different label. No accounting defect or safe exemption was established.

The diagnostic spent exactly three new Responses calls: critique, one repair and final verification. It reused the original generation, made no actor starts, did not enter native QA, and produced no validated Markdown artifact. Raw failed receipts and persistent state remain unchanged (26 runs / 44 failure records, state SHA-256 `6dd9f7f5893b9e6149695cfe3f3adcb6ab9e71384d0be48b45a23e7ca6b0691e`). The second isolated full-suite confirmation again passed all 2,583 tests without skips. The citation-metadata and editorial-review fixes are verified; uninterrupted fresh article-to-native-QA proof remains outstanding.
