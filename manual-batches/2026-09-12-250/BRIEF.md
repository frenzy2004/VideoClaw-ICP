# Expansion to 250 manual review articles

The user approved 250 TOTAL articles, exactly 50 per each of five ICPs. Preserve
the existing 50 at ../2026-09-12-50 unchanged; author 200 additional articles,
40 per campaign. This is the previously approved manual review workflow, not a
new autonomous worker, another pilot, publication approval or a deployment.

Branch: content/manual-review-batch-250, from 900053a. Only this new batch folder
may be changed. Never edit original lander, worker runtime, credentials, retry
state, schedules, existing 50, PR55 or production branches. Main handles Git.

## Phase 1: topics

Each campaign researcher owns topics/<campaign>.json. Produce 40 distinct records
numbered 011–050. Use live search to discover plain-language queries and relevant
primary-source material. Existing matrices are hypotheses, not verified evidence.
Read all existing 50 topic titles/queries and the three lander topics before
choosing yours. Do not turn a synonym or another industry name into a new article
with the same answer. Every topic needs a materially distinct job and work product.

Schema per record:

```json
{
  "id":"vc-manual250-c1-011",
  "campaign":"newly-funded-founder",
  "icp":"Specific approved ICP",
  "customerTrigger":"Specific situation",
  "funnelStage":"awareness",
  "keyword":"natural search phrase",
  "title":"Reader-facing title ideally under 65 characters",
  "slug":"unique-human-readable-slug",
  "distinctIntent":"Exact job to solve and how it differs from existing topics",
  "originalWorksheet":"Specific original template, example, procedure or calculation",
  "sourceCandidates":[{"url":"https://primary-page","supports":"Specific relevant fact; say uninspected if only discovered"}]
}
```

Funnel values: awareness, consideration, decision. Campaign numbers: c1 newly
funded founder, c2 accelerator/Demo Day, c3 video-production comparison, c4 GTM
repurposing buyer, c5 portfolio-media platform. Keep assigned IDs and campaign.
Search volume/KD/CPC remain unknown. Do not fabricate PAA or competitor findings.
Main collects exact US/en SERPs and checks cross-campaign overlap before writing.
Stop after the topic manifest and report it; do not write bodies before the
main agent sends the approved writing assignment.

## Phase 2: complete articles (only when assigned)

Follow ../2026-09-12-50/BRIEF.md's body/JSON author format. Save paired files in
drafts/<campaign>/<slug>.md and .json, immediately after each article rather than
holding forty outputs in memory. Target 1,000–1,500 useful body words, 40–60-word
direct answer, 5–8 H2s, distinct original work product, two or more genuinely
inspected relevant sources including a primary source, exactly three FAQs, and
two exact combined-library related slugs. No public research/compliance boilerplate,
invented prices or benchmarks, raw HTML, H1 or unsupported VideoClaw capabilities.
Use clear practical advice, not repeated ownership/review checklists in every
article. Methods and examples should vary with the reader's task. Preserve
source-derived wording limits across your work; original practical synthesis is
the majority of each article. Citation notes do not prove claims by themselves.

Product media uses the approved existing lander asset allowlist. Main assembles
frontmatter and SVGs; status remains review, approvals false, no publishedAt,
/download CTA. Real measured keyword metrics may not be invented.

## Main execution checklist

- [ ] Validate 40 new distinct intents per campaign against all retained content.
- [ ] Collect exact US/en organic SERP evidence for the 200 new queries.
- [ ] Write 200 complete paired article bodies and metadata; assemble incrementally.
- [ ] Run independent editorial reviews and cross-library duplicate/link checks.
- [ ] Validate all 250 against native lander code in a remote-free local clone.
- [ ] Check local rendering, media, canonical/noindex/discovery behavior.
- [ ] Commit checkpoints, push a separate draft PR, hand over all PR links.

Delivery must distinguish 250 review drafts from 250 demand-validated or approved
posts. Paid keyword access, final editorial/media approval, production publishing
and unattended worker operation remain separate milestones.
