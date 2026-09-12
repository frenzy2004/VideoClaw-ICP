# VideoClaw: 50 manual review articles

This is a separate AI-assisted editorial batch requested on September 12, 2026.
It contains **50 complete Markdown articles, ten per ICP**, not fifty outlines or
worker retries. Every article remains `review`, every approval flag is false,
and none has a publication date.

[Draft review PR #2](https://github.com/frenzy2004/VideoClaw-ICP/pull/2) targets the
worker feature branch, not production. The complete content checkpoint is
`18b6981`; subsequent documentation commits do not change article approval state.

Start with [the article index](INDEX.md). Each row links to the complete Markdown
source. The frontmatter retains the ICP, trigger, exact keyword, search intent,
SERP provenance, sources, FAQs and media mapping. Those research fields are not
shown as public debug panels by the lander renderer.

## What is included

- `articles/`: 50 native-format Markdown articles, approximately 1,100–1,300 body
  words each, with practical templates, examples or worksheets.
- `media/`: 50 distinct branded editorial SVGs. Article records reuse three
  existing VideoClaw video/poster pairs; the videos are **not fifty new demos**.
- `editorial-notes/`: source-support notes, actual FAQ evidence classification,
  competitor-gap hypotheses and exact SERP records.
- `topics.json`, `serp-*.json`: selected queries and compact evidence from 64
  Apify queries across three runs. Each final query has organic-result evidence.
- Audit reports and independent campaign reviews.

## Important limits

Search results show the search landscape, not measured demand. Volume, difficulty
and CPC remain `provider-pending`. Of 150 FAQs, 35 exactly match an observed PAA
question; the others are explicitly editorial in the private evidence notes.
Some topics retain mixed search intent: see [search decisions](SEARCH-INTENT-NOTES.md).
Do not treat all fifty as equally strong publication opportunities.

Sources were checked editorially with a separate automatic transport audit. See
[source verification](SOURCE-VERIFICATION.md) for its 41 automatic retrievals and
23 fallback checks. Team editorial, visual and media-accessibility approval is
still required before any publication.

## Isolation and local review

Branch: `content/manual-review-batch-50`, based on worker commit `3bd98f5`.
No worker code, retry state, recurring schedule, original lander files, PR #55,
production branch or deployment is changed by this batch.

The local renderer is a disposable, remote-free clone of the lander review branch
at `b6b0833c78443b44b12bf6d33f05baa7ac8427d3`. It contains these fifty plus the
three existing review articles, so the local index shows **53** guides.

Local review while the server is running: <http://127.0.0.1:3004/blog>.
This address works only on the machine running the preview, not for remote team
members. Share the GitHub Markdown index for remote copy review.

## Rechecking the delivered content

From the worker repository, with its dependencies installed:

```sh
npx tsx manual-batches/2026-09-12-50/audit-content.ts
npx tsx manual-batches/2026-09-12-50/validate-native.mts /tmp/videoclaw-manual50-REVIEW/lander
```

The second command requires a disposable clone of `seo/founder-video-blog-launch`
with dependencies installed and **no Git remotes**. It refuses an ordinary lander
path, imports that clone's actual contract, and copies only the review articles
and graphics into the clone. Run its native `check:blog`, lint and preview build
there. No schema is copied into this batch.

`assemble.ts` and `collect-serps.ts` document the one-off authoring and collection
steps. Ignored `drafts/` contains author scratch inputs; the delivered `articles/`
are the canonical complete source. Do not rerun paid collection to review this
batch. Raw page contents, credentials and private runtime state are not included.
