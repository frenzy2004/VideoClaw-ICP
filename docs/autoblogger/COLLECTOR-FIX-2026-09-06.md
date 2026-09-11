# US SERP collector correction — 6 September 2026

## Outcome and scope

The collector's extra `searchLanguage: en` setting applied Google's
`lr=lang_en` page-language restriction in addition to the English interface.
Two controlled comparisons for `product demo checklist` returned zero organic
results with this filter and eight without it. Saved Google HTML confirmed the
empty results originated upstream; our JSON normalizer was not discarding links.
This demonstrates the effect for this query and collector, not a universal Google
language-filter defect or evidence of measured search demand.

The worker now omits this optional restriction for initial, retry and supporting
source searches. It retains `countryCode: us`, `languageCode: en`, desktop and
first-page validation. Describe these as **US/English-interface** observations,
not guaranteed English-only pages. No alternative actor, HTML parser, source
allowlist expansion or evidence-gate relaxation was introduced.

Apify documents the difference between `searchLanguage` (`lr`, page restriction)
and `languageCode` (`hl`, interface) in its
[official input schema](https://apify.com/apify/google-search-scraper/input-schema).

## Controlled live comparisons

All four runs used `apify/google-search-scraper`, the same locale/device/page
settings and `saveHtml: true`. Only the optional language restriction changed
within each pair. Raw HTML stays in the Apify datasets; local diagnostic receipts
contain hashes and bounded structural observations, not committed page copies.

| Observation | Run ID | Dataset ID | Product-demo organic results |
| --- | --- | --- | --- |
| English-page filter, first control | `CjurIyK1xu70ExeNI` | `1yahaERjr9SmQ41DA` | 0 |
| English interface, no page filter | `HZLiAZ9bhcN2Ppa4p` | `Nxt3WpBa4hWGz5lNz` | 8 |
| English-page filter, repeated control | `HZjT8mYLSzXMnHvLZ` | `jNjAnsX2XRQea1Yp0` | 0 |
| English interface, repeated comparison | `MZNACCdgbD3zTrnSp` | `Z1MEgPb63g7WOukAR` | 8 |

The repeated pair also checked `demo day video checklist`: eight organic results
with the filter and seven without it. This supports a query-specific collection
effect, not a claim that every filtered query is empty. Search results can vary
between requests; no ranking-position equivalence is asserted.

## Fresh production research-path verification

After the code correction, the real `createResearcher.scan()` and `inspect()`
collected and checked the existing product-demo candidate again from scratch.
They did not reuse the comparison datasets or manually supplied sources.

| Stage | Run ID | Dataset ID |
| --- | --- | --- |
| Autocomplete | `2XYpGIyg0odeyYvuM` | `e84fackCyTxo60Twa` |
| Primary organic SERP | `kquPs6B3vJmHioyZu` | `1dg0R7T0WpibrKRnR` |
| Dedicated PAA collection | `vP2KnB8agmHiBiBk7` | `cnuG7nFCswx9pSk6E` |
| Supporting primary-source discovery | `YKzrTTTwuHPQnqEod` | `CNnQVvF9WdvkL5sDl` |

Result: eight organic competitors, nine observed questions, three selected
relevant FAQs, and four automatically retrieved source bodies with eighteen
bounded body-context groups. The draft-input contract and pending-metrics pilot
eligibility check passed. The selected questions were:

- When starting a product demo, what should you do first?
- Can you give me an example of a product demo?
- How to structure a product demo?

Retrieved sources:

- [CloudShare demo checklist](https://www.cloudshare.com/blog/demo-checklist/)
- [Product Marketing Alliance checklist](https://www.productmarketingalliance.com/product-demo-checklist-template-framework/)
- [Walnut product-demo checklist](https://www.walnut.io/blog/product-demos/the-ultimate-product-demo-checklist-for-saas-companies/)
- [YC guide to Demo Day pitches](https://www.ycombinator.com/blog/guide-to-demo-day-pitches/)

YC satisfied the existing authoritative-source policy. That does not make its
Demo Day guidance proof of every customer-demo claim; subsequent drafting and
independent review must respect the source's context. PAA answers and SERP
snippets were not promoted to body facts. Paid metrics remain pending.

Exact inputs, selected context, fetch provenance and content hashes are retained
privately under `artifacts/autoblogger/collector-diagnostic-20260906/`.

## Remaining milestone

This verifies **automatic research → source verification → valid drafting
input**, not a completed article. Zero model calls, worker reservations, Markdown
articles, native generated-article QA passes or lander PRs occurred in this check.
The retained state hash was unchanged throughout all diagnostics.

The previous failed worker run and consumed target switch remain intact. The old
candidate's three failures and unused parked grant are also unchanged. A new
article run requires explicit retry reconciliation; relabelling a direct model
call as a diagnostic would bypass that guard and was not done.

No production branch, lander source, PR #55, publishing, deployment or schedule
was changed. The next engineering milestone remains one bounded, review-only
article run through drafting, critique/repair and native lander QA.
