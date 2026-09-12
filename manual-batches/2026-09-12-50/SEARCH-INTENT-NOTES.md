# Search intent decisions for the manual batch

These are editorial draft decisions supported by current search-landscape
observations, not proof of search demand or likely rankings. Paid keyword volume,
difficulty and CPC remain unavailable. None of these drafts is authorized for
indexing.

## Collection

- Initial fifty queries: Apify run `VMTK8QQ0C4Cf7WZXf`, dataset `MexeNaX1RsSZJmAZ7`.
  All fifty returned organic results. Thirty-three had PAA observations; forty-four
  had related-query observations. Those counts do not establish relevant FAQs.
- A distinct investor-question topic replaced the one-minute pitch, which would
  overlap the existing lander draft: run `7FYXmPNQGfKKxOPHt`, dataset
  `X8mLiehDsNnyYdZzy`.
- Thirteen query refinements: run `1TRKQT0t6mrbtBkVz`, dataset
  `sxgEp2jc602xi3TP6`. All thirteen returned organic results.
- Each article uses the exact matching final query's run/dataset/date. The original
  observations remain in the batch so the refinements can be traced backwards.

## Evidence-led changes

| Original query | Final query | Reason |
|---|---|---|
| startup funding announcement | how to announce startup funding | Initial results were funding news; the article teaches announcement preparation. |
| demo day checklist | startup demo day checklist | Initial results concerned home demonstrations, not accelerator founders. |
| investor update video | startup investor update video | Initial results emphasized public-market investor updates. |
| pitch rehearsal | startup pitch rehearsal | Initial results included musical/phonological meanings of pitch. |
| demo day follow up email | investor follow up email after demo day | Initial results emphasized sales demonstrations. |
| software tutorial video | how to make software tutorial videos | Initial results emphasized software lists rather than making a tutorial. |

Other refinements make the startup context explicit; see `topics.json` and the
refined evidence file for the complete exact-term mapping.

## Remaining intent limitations

Some portfolio-operator topics have mixed or indirect search intent even after
refinement. These require human prioritization before production:

- Accelerator marketing results mix founder marketing and operator recruitment.
- Filming a startup demo day overlaps individual product-demo recording.
- Founder interview questions mix employment interviews with editorial interviews.
- Portfolio newsletter results include reading recommendations, not just production.
- Founder content workshop results include courses and training providers.

The video resizing and long-to-short clip queries are also tool-heavy; an
instructional article may support those needs without matching the main result
format. Do not call an editorial gap a measured competitive advantage.

The batch retains these as explicitly review-only opportunities because the
manual request covers all five ICPs. Their status is not changed to validated
demand just to reach fifty outputs. FAQ evidence notes distinguish exact observed
Google questions from useful questions written editorially.
