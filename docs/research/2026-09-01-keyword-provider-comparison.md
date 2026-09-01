# VideoClaw keyword-provider comparison

Checked against official provider documentation on 2026-09-01. This document separates provider facts from the VideoClaw implementation recommendation. It does not claim that VideoClaw currently has an account, subscription, API entitlement, credit balance, or usable credential for any provider.

## Decision

1. **Semrush first** for pre-publication US keyword enrichment.
2. **Ahrefs as the preferred alternative** if its available account/API entitlement or metrics fit the workflow better.
3. **Similarweb as a supplementary source**, especially where click distribution and zero-click context alter the value of apparent demand.
4. **Google Search Console after publication** as first-party evidence of how VideoClaw pages actually appear and perform in Google Search.

This ordering is a VideoClaw recommendation, not a provider fact. No provider value is copied into an article until it is observed through authenticated access, tagged with provider, US market, and observation date, and accepted by `normalizeKeywordImport`. Apify SERP observations remain separate: they validate a live result landscape, not proprietary volume, difficulty, CPC, or traffic-potential metrics.

## Comparison

| Provider | Officially documented data relevant to this project | Official access/usage model | VideoClaw role | Important limitation |
| --- | --- | --- | --- | --- |
| Semrush | The v4 keyword-metrics endpoint documents search volume, keyword difficulty, CPC, intents, number of results, trends, and SERP features. Semrush also documents Project APIs including Position Tracking and Site Audit. | v4 uses API-key authentication. Semrush says eligible paid access is required; its Standard API documentation currently identifies SEO Toolkit Business access. The v4 keyword endpoint is Early Access and documents 20 API units per request. | **First integration recommendation.** It covers the core import fields and can later support a broader SEO workflow under one provider relationship. | v4 keyword reports are currently Early Access, so endpoint shape and usage terms may change. Access and available units must be verified in the actual account before implementation. |
| Ahrefs | Keywords Explorer v3 documents volume, monthly volume/history, difficulty, CPC, clicks, click share, intent, parent topic, traffic potential, and SERP features. A separate SERP Overview endpoint exposes ranking-result data. | Ahrefs says API access is available on eligible paid plans, with limited free test queries on other plans. Non-free requests use API units with a documented minimum base cost of 50 units; selected fields can increase per-row cost. | **Preferred alternative.** Particularly useful when traffic potential, click behavior, parent-topic clustering, and backlink-informed difficulty are central to selecting or consolidating topics. | It does not replace the independent live Apify evidence already required by the article contract. Actual plan eligibility and unit budget are unverified. |
| Similarweb | The v5 data catalog documents Keywords Overview metrics including volume, click breakdown, zero clicks, difficulty, competition, CPC bid range, intent distribution, and AI Overview/SERP click context. Website-keyword APIs add traffic share, position, SERP features, and top URL. | Similarweb says API requests use API keys from an active account with API access. Usage is metered in data credits; available metrics, countries, dates, and granularity depend on account capabilities, which can be inspected through `describe` or capabilities endpoints. | **Supplementary source.** Use when volume alone is misleading and click/zero-click or competitive-traffic context changes prioritization. | Coverage and accessible fields are subscription-dependent. Similarweb metrics must retain their provider identity and must not be mixed into Semrush/Ahrefs columns as though the methods were interchangeable. |
| Google Search Console | Search Analytics returns first-party query/page performance with clicks, impressions, CTR, and average position, filterable by dimensions such as query, page, country, device, and date. | Requests require authorization to a Search Console property. Google notes that the API is bounded by internal limits and does not guarantee every data row, returning top rows. | **Post-publication source of truth.** Use it to measure impressions, clicks, CTR, and position for published VideoClaw URLs and to discover real queries that merit refreshes or supporting pages. | It is not a pre-publication keyword-volume, CPC, or keyword-difficulty provider. Its observations exist only after Google has data for an authorized property. |

## Official sources

### Semrush

- [Semrush SEO API v4 overview](https://developer.semrush.com/api/v4/seo/overview/)
- [Semrush v4 keyword reports and Get Keyword Metrics](https://developer.semrush.com/api/v4/seo/keyword-reports/)
- [Semrush API access](https://developer.semrush.com/api/v4/get-started/api-access/)
- [Semrush API versions](https://developer.semrush.com/api/v4/introduction/api-versions/)
- [Semrush Projects, Position Tracking, and Site Audit API overview](https://developer.semrush.com/api/v3/projects/overview/)
- [Semrush Position Tracking API](https://developer.semrush.com/api/v3/projects/position-tracking/)

### Ahrefs

- [Ahrefs API introduction and eligibility](https://docs.ahrefs.com/en/api/docs/introduction)
- [Ahrefs Keywords Explorer endpoints](https://docs.ahrefs.com/en/api/reference/keywords-explorer)
- [Ahrefs Keywords Explorer overview fields](https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-overview)
- [Ahrefs API unit consumption](https://docs.ahrefs.com/en/api/docs/limits-consumption)
- [Ahrefs free test queries](https://docs.ahrefs.com/en/api/docs/free-test-queries)

### Similarweb

- [Similarweb v5 available data](https://docs.similarweb.com/api-v5/guides/available-data)
- [Similarweb v5 authentication](https://docs.similarweb.com/api-v5/getting-started/authentication)
- [Similarweb API data-credit calculation](https://docs.similarweb.com/api-v5/guides/data-credits-calculations)
- [Similarweb Website Keywords API](https://developers.similarweb.com/reference/website-analysis-keywords)

### Google Search Console

- [Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Analytics query guide](https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics)

## Integration boundary

The initial adapter normalizes only the shared pre-publication fields used by article frontmatter: provider, keyword, `US`, observation date, volume, difficulty, CPC, intent, and validation status. It preserves missing optional numeric fields as `null`; it never estimates them. A named provider record is rejected unless it has an observation date and at least one observed numeric metric. Pending records are rejected if they contain a date or any numeric metric, including zero.

Google Search Console needs a separate post-publication observation shape for clicks, impressions, CTR, and average position. Those values must never be renamed to volume, difficulty, or CPC merely to fit the pre-publication adapter.

## Credential and rollout gate

- Keep every API key server-only and outside source control, Markdown, browser JavaScript, test fixtures, screenshots, and logs.
- Before selecting a provider, verify the real account's API entitlement, accessible US datasets, current usage model, and an affordable test batch. No access or price is assumed here.
- Import a small US sample, retain the raw provider export outside the published content tree, and compare normalized records against the provider UI before enriching the 250 article records.
- Keep paid-provider fields `pending_paid_provider` until that verification succeeds. Public indexing remains fail-closed.
