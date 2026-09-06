# Source planning and reference-check correction

Scope: worker PR #1 only. This is an offline engineering correction, not another
live pilot or a successful article milestone. No paid calls, new retry authority,
state reset, lander changes, publication or schedule activation occurred.

## Root causes and changes

1. The writer received uneven source inventories without a bounded source-use
   plan. It now receives up to three distinct anchor fact IDs per source page,
   favoring explicitly retrieved body facts and requiring non-stopword query
   overlap. Duplicate normalized text cannot consume multiple slots. This is a
   conservative lexical suggestion, not semantic relevance validation; a page
   can have no suggested anchors. The full evidence inventory and
   exact provenance are preserved. Reader-task guidance calls for original
   decisions, a hypothetical example and troubleshooting, not a competitor's
   outline. Anchors do not certify support or force irrelevant sources into prose.
2. The 180-word per-source limit previously relied on a prose instruction and
   model critique. Code now sums reviewer-classified source-derived words across
   body, headings, description, FAQ answers and graphic text. Query/trailing-slash
   aliases share an allowance. A multi-source span is charged fully to each page.
   Missing, stale or duplicate review classifications cannot exempt prose.
3. Repair instructions told the model to preserve supported prose even when
   extensive restructuring was needed. Aggregate violations now carry a source
   usage ledger, binding locations and explicit whole-article restructuring
   instructions into the existing single repair. The final review is counted
   again, and unresolved excess blocks a bundle even if a critic approves it.
   No second repair or fifth model call was added.
4. The generic recording-workflow heading example was removed. The writer must
   use headings appropriate to the reader task and evidence; VideoClaw being a
   video tool does not establish that every guide needs a recording workflow.
5. The product-reference resolver now recognizes a narrow imperative/local-object
   construction using bounded editorial-artifact categories, not a sentence whitelist.
   Grammar alone cannot distinguish unknown lowercase brands from common nouns;
   unknown object heads remain blocked. It also requires an entire editorial-relation clause and restricts instrument-like
   "Use" constructions. Named-product/software context, ambiguous suffixes and
   capability claims remain blocked in the regression suite. This resolves a
   grammatical reference, not factual truth or all possible natural-language ambiguity.
6. Independent review found a binding-coverage mismatch: the lander renders FAQ
   answers as literal text, while the checker parsed them as Markdown and silently
   omitted fenced blocks and definitions. Actual Markdown body fields, including
   section headings in their emitted ATX-heading context, use Markdown parsing;
   native plain fields retain all their literal text in
   binding checks. Missing text blocks acceptance even when both model reviews
   approve the remaining bindings. Source accounting depends on complete coverage.
   Follow-up review also reproduced a formatted product name in a heading evading
   literal alias checks; heading checks now use the text the Markdown renderer displays.

The counting guard depends on independent model classification; it does **not**
prove originality or semantic support. Review must still reject close paraphrases
disguised as original advice. Original guidance may cite a fact for context without
being derived from its wording or structure. The limit was not increased.

## Saved-run audit

Input: `automated-product-demo-editorial-pilot-2026-09-07`, original fourth attempt.
Context and all four response receipt payload hashes were verified. The exact
saved JSON outputs were replayed through the changed drafter offline, without
editing article copy, supplied facts or model verdicts.

| Check | Result |
| --- | --- |
| Source-plan anchors | 0 / 3 / 2 / 0 across the four retrieved source pages; full facts retained |
| CloudShare reviewed source-derived public words | 845; blocked against limit 180 |
| Product Marketing Alliance reviewed source-derived words | 50 |
| Saved binding 34 ordinary-object instruction | No longer incorrectly classified as a product claim |
| Independent excessive-derivation and recording-heading findings | Retained; article remains blocked |
| Replay outputs | Four simulated phases, no bundle, no network requests |
| Saved receipts and persistent state | Byte-identical after replay |

The terminal candidate still has four attempts. Its state hash remains
`8afa248b30aebbc5ce32dba3820ba9f217f3e8907442560b3a25c0d2c496b67c`.
The lander remains clean at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`.

## Verification

Nine source-planning/accounting regressions were observed failing before
implementation, followed by three failing orchestration regressions. Independent
review then reproduced an overbroad imperative exception, literal-FAQ coverage
bypasses and duplicate/off-topic anchors. These were corrected with further RED
regressions: 17 product-reference cases and 25 literal-field cases, plus the main
orchestration's fenced/definition FAQ reproductions. Three heading regressions and
three additional unknown-object cases were also observed RED before correction.
An explicit nullable regex result resolved a final TypeScript union error without
changing the reference rule. All six ordinary-artifact
positives and the saved binding 34 remain accepted by the reference checker.
The integration tests prove budget-driven repair and post-repair rejection with
fixture reviews, not fresh model performance.

Final repository checks and independent review are recorded in VERIFICATION.md.
No native QA pass is claimed for the blocked saved article. The existing native
parser/fixture-renderer end-to-end test remains a synthetic pipeline check.

## Remaining milestone

These corrections are ready for engineering review, not proof that a newly
generated article passes automatically. A further live attempt needs separately
recorded authorization because the current candidate's allowance is exhausted.
The source, editorial, media and native QA gates remain mandatory. Unattended
operation additionally needs scoped lander access and configured provider secrets;
production publishing still requires human approval.
