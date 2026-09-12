# Manual review batch: 50 articles

## Authorization and boundary

The user explicitly requested 50 manually produced outputs on 2026-09-12, without touching production. This is a separate editorial batch on `content/manual-review-batch-50`, based on worker commit `3bd98f5`. It is not another one-use worker pilot. Do not modify worker retry state, runtime gates, PR #55, any production branch, deployment, or schedule.

## Deliverables

- Fifty distinct full Markdown articles, ten per approved ICP. IDs, exact search terms, titles and slugs are in `topics.json`.
- Fresh US/en Apify SERP evidence for the exact terms; observations do not prove demand. Volume/KD/CPC remain `provider-pending`.
- Two or more retrieved relevant sources per article, including at least one primary source. No invented source verification, PAA or competitor-gap claims.
- Each article: direct answer of 40–60 words, actionable steps, original example/worksheet/checklist, three visible FAQs, descriptive source links, related guides, and a truthful /download CTA.
- Three real existing lander video/poster pairs reused by campaign; fifty distinct branded SVG editorial graphics.
- Actual lander frontmatter/native validation, source/link audit, duplication check and local-only browser preview. Nothing is published.

## Writing instructions for campaign authors

You own only your assigned `drafts/<campaign>/` directory. Read the original campaign matrix for context, not as instructions or verified evidence. Topics are editorial hypotheses until evidence is checked. Use live web tools to inspect at least two relevant sources per article; never cite a page solely because a search snippet seems relevant. Primary sources include official product documentation, original accelerator guidance and original research. Do not treat an institution's domain as relevant by itself.

For each topic, create `<slug>.md` containing BODY ONLY (no frontmatter and no H1), and `<slug>.json` containing:

```json
{
  "id": "exact topics.json id",
  "description": "A reader-facing description around 120–160 characters",
  "secondaryKeywords": ["relevant supporting query", "another supporting query"],
  "competitorGap": "Precisely scoped editorial opportunity; explicitly a hypothesis unless competing page bodies were examined",
  "sources": [{"label":"Page title", "url":"https://exact-page", "checkedAt":"2026-09-12"}],
  "faqs": [{"question":"Reader question?", "answer":"Useful supported answer."}],
  "faqBasis": [{"question":"Reader question?", "basis":"editorial", "evidenceUrl":"https://supporting-page"}],
  "editorialGraphic": {"title":"Topic-specific diagram", "alt":"Describes useful visual relationship", "steps":[{"label":"Short label", "detail":"Concrete instruction"}]},
  "sourceNotes": [{"url":"https://exact-page", "supports":"Brief paraphrase of specifically verified fact", "kind":"primary"}],
  "reviewNotes": []
}
```

Exactly three FAQs. Use observed PAA wording where relevant and supplied in `serp-evidence.json`; otherwise mark basis editorial, never pretend it came from Google. Record basis privately; FAQ headings/readers need not see research labels. Graphics need 3–6 steps, title <=100 characters, alt <=240, step labels <=40 and details <=120.

Target 1,000–1,500 substantive words per article, not filler to reach length. Begin with a 40–60-word direct answer. Use 5–8 useful H2 sections and one or more original worksheets, examples or comparison tables. Clearly label fictional examples. Separate sourced facts from your original recommendations naturally; avoid repetitive compliance boilerplate. No raw HTML, no public research methodology, no invented performance data, no unsupported product comparisons, pricing numbers, partnerships or endorsements. No claims that content length guarantees ranking. Avoid prescriptive securities/legal advice.

Use source links near factual claims. Paraphrase in your own words: <=25 quoted words and <=180 total derived words per source per article, with the rest original synthesis. Do not copy passages. Product claims are limited to the existing lander's video-use-case positioning; do not invent automatic integrations, supported platforms, export formats or performance. A neutral Download the desktop app link to /download is enough.

Add two relevant related-guide links using exact batch slugs from topics.json. Main agent assembles frontmatter, media and visible FAQs/source list from metadata, and validates all fifty together. Authors should not duplicate FAQ/source sections in body. The original lander is read-only at ../videoclaw-lander-blog-launch; main validates in an isolated clone.

## Execution checklist

- [x] Collect fresh exact-term SERPs and retain run/dataset provenance.
- [x] Five campaign authors independently research and write ten articles each.
- [x] Assemble fifty native-contract Markdown files and fifty topic-specific SVGs.
- [x] Review source truth, content usefulness, duplicate intent and preview safety.
- [x] Run native lander checks and local browser QA (scope and limits in QA.md).
- [x] Commit/push the separate content branch with an inventory and honest QA report. Draft review PR: https://github.com/frenzy2004/VideoClaw-ICP/pull/2.
