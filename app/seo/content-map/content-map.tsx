'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  ArticleRecord,
  CampaignId,
  LibraryAdvisory,
} from '../../../lib/content/articles';
import {
  auditArticle,
  isArticlePublishable,
  type ArticleAudit,
  type AuditCategoryName,
} from '../../../lib/seo/article-audit';

const CAMPAIGN_LABELS: Record<CampaignId, string> = {
  'newly-funded-founder': 'Newly funded founder',
  'accelerator-demo-day-founder': 'Accelerator / Demo Day founder',
  'video-production-comparison': 'Video production comparison',
  'gtm-content-repurposing-buyer': 'GTM content repurposing buyer',
  'portfolio-media-platform': 'Portfolio media platform',
};

const CAMPAIGNS = Object.entries(CAMPAIGN_LABELS) as [CampaignId, string][];
const QA_CATEGORIES: { key: AuditCategoryName; label: string }[] = [
  { key: 'technical', label: 'Technical' },
  { key: 'attribution', label: 'Attribution' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'media', label: 'Media' },
  { key: 'keyword', label: 'Keyword' },
];
const SOURCE_REPOSITORY = 'https://github.com/frenzy2004/VideoClaw-ICP/blob/codex/demo-day-seo-campaign';

type ContentMapRow = {
  article: ArticleRecord;
  audit: ArticleAudit;
  articleReady: boolean;
  publishable: boolean;
};

export type ContentMapProps = {
  existingAssetPaths: string[];
  globalIndexingEnabled: boolean;
  records: ArticleRecord[];
  targetAdvisories: LibraryAdvisory[];
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sourceHref(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/').replace(/^.*?(content\/articles\/)/, '$1');
  return `${SOURCE_REPOSITORY}/${encodeURI(normalized)}`;
}

function scoreClass(score: number): string {
  if (score === 100) return 'is-complete';
  if (score >= 70) return 'is-progressing';
  return 'is-blocked';
}

function categoryHasBlocker(audit: ArticleAudit, category: AuditCategoryName): boolean {
  return audit.blockingFindings.some((finding) => finding.category === category);
}

function QaScores({ audit }: { audit: ArticleAudit }) {
  return (
    <ul className="content-map-scores" aria-label="VideoClaw editorial QA scores">
      {QA_CATEGORIES.map(({ key, label }) => (
        <li key={key}>
          <span>{label}</span>
          <strong className={scoreClass(audit.categories[key].score)}>{audit.categories[key].score}%</strong>
        </li>
      ))}
    </ul>
  );
}

function WorkflowDiagram() {
  return (
    <section className="content-map-workflow" aria-labelledby="content-map-workflow-heading">
      <div>
        <p className="content-map-kicker">Traceability model</p>
        <h2 id="content-map-workflow-heading">Every page has an evidence chain.</h2>
      </div>
      <ol aria-label="Content publication workflow">
        {[
          ['Research signals', 'Customer language, funding, cohort, launch, and competitor observations.'],
          ['Keyword validation', 'Observed US SERPs now; authenticated volume, difficulty, and CPC when available.'],
          ['Markdown source', 'Canonical frontmatter, article body, citations, media, and CTA in version control.'],
          ['Editorial QA', 'Deterministic technical, attribution, evidence, media, and keyword checks.'],
          ['Rendered page', 'Human-readable /blog/<slug> output with review provenance.'],
          ['Sitemap gate', 'Only fully approved records can enter discovery when global indexing is enabled.'],
        ].map(([label, description], index) => (
          <li key={label}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
            <p>{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ContentMap({
  existingAssetPaths,
  globalIndexingEnabled,
  records,
  targetAdvisories,
}: ContentMapProps) {
  const [campaignFilter, setCampaignFilter] = useState<'all' | CampaignId>('all');
  const [funnelFilter, setFunnelFilter] = useState<'all' | 'top' | 'middle' | 'bottom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'review' | 'publishable'>('all');
  const [indexingFilter, setIndexingFilter] = useState<'all' | 'index' | 'noindex'>('all');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'clear' | 'blocking'>('all');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'clear' | 'blocking'>('all');
  const [keywordFilter, setKeywordFilter] = useState<'all' | 'pending_paid_provider' | 'validated'>('all');

  const rows = useMemo<ContentMapRow[]>(() => {
    const availableAssets = new Set(existingAssetPaths);
    return records.map((article) => {
      const audit = auditArticle(article, (src) => availableAssets.has(src));
      return {
        article,
        audit,
        articleReady: isArticlePublishable(article, audit, true),
        publishable: isArticlePublishable(article, audit, globalIndexingEnabled),
      };
    });
  }, [existingAssetPaths, globalIndexingEnabled, records]);

  const totals = useMemo(() => ({
    all: rows.length,
    blockingFindings: rows.reduce((sum, row) => sum + row.audit.blockingFindings.length, 0),
    byCampaign: Object.fromEntries(CAMPAIGNS.map(([campaignId]) => [
      campaignId,
      rows.filter((row) => row.article.frontmatter.campaign_id === campaignId).length,
    ])) as Record<CampaignId, number>,
    pendingKeywords: rows.filter((row) => row.article.frontmatter.keyword_evidence.validation_status !== 'validated').length,
    publishable: rows.filter((row) => row.publishable).length,
  }), [rows]);

  const filteredRows = useMemo(() => rows.filter(({ article, audit }) => {
    const { frontmatter } = article;
    const evidenceBlocked = categoryHasBlocker(audit, 'evidence');
    const mediaBlocked = categoryHasBlocker(audit, 'media');
    return (campaignFilter === 'all' || frontmatter.campaign_id === campaignFilter)
      && (funnelFilter === 'all' || frontmatter.funnel_stage === funnelFilter)
      && (statusFilter === 'all' || frontmatter.status === statusFilter)
      && (indexingFilter === 'all' || frontmatter.indexing === indexingFilter)
      && (evidenceFilter === 'all' || (evidenceFilter === 'blocking' ? evidenceBlocked : !evidenceBlocked))
      && (mediaFilter === 'all' || (mediaFilter === 'blocking' ? mediaBlocked : !mediaBlocked))
      && (keywordFilter === 'all' || frontmatter.keyword_evidence.validation_status === keywordFilter);
  }), [
    campaignFilter,
    evidenceFilter,
    funnelFilter,
    indexingFilter,
    keywordFilter,
    mediaFilter,
    rows,
    statusFilter,
  ]);

  return (
    <main className="content-map-page">
      <p className="content-map-review-ribbon">PRIVATE SEO OPERATIONS · ALWAYS NOINDEX</p>
      <header className="content-map-masthead">
        <Link className="wordmark" href="/">VideoClaw</Link>
        <span>SEO · AEO · GEO content operations</span>
        <Link href="/">Review home</Link>
      </header>

      <section className="content-map-hero">
        <p className="content-map-kicker">Five ICP campaigns · one traceable system</p>
        <h1>SEO content map</h1>
        <p>
          This is the operational view of every canonical Markdown article. Counts, QA scores, blockers,
          and publication readiness are calculated from the source records—not typed into this screen.
        </p>
        <p aria-live="polite">
          <strong>Global public indexing {globalIndexingEnabled ? 'enabled' : 'disabled'}</strong>
          {' · '}
          Article-level readiness is evaluated separately from the active global sitemap gate.
        </p>
      </section>

      <section className="content-map-summary" aria-label="Article library totals">
        <article data-testid="content-map-total">
          <span>Total articles</span>
          <strong>{totals.all}</strong>
        </article>
        <article data-testid="content-map-publishable">
          <span>Publicly indexable now</span>
          <strong>{totals.publishable}</strong>
        </article>
        <article data-testid="content-map-pending-keywords">
          <span>Pending keyword validation</span>
          <strong>{totals.pendingKeywords}</strong>
        </article>
        <article data-testid="content-map-blockers">
          <span>Blocking findings</span>
          <strong>{totals.blockingFindings}</strong>
        </article>
      </section>

      <section className="content-map-campaigns" aria-label="Campaign totals">
        {CAMPAIGNS.map(([campaignId, label]) => (
          <article data-testid={`campaign-total-${campaignId}`} key={campaignId}>
            <span>{label}</span>
            <strong>{totals.byCampaign[campaignId]}</strong>
          </article>
        ))}
      </section>

      {targetAdvisories.length > 0 ? (
        <section className="content-map-inventory" aria-labelledby="content-map-targets-heading">
          <div className="content-map-inventory-heading">
            <div>
              <p className="content-map-kicker">Non-blocking planning targets</p>
              <h2 id="content-map-targets-heading">Research target advisories</h2>
            </div>
            <p>{targetAdvisories.length} target shortfalls</p>
          </div>
          <ul className="content-map-findings">
            {targetAdvisories.map((advisory) => (
              <li key={advisory.code === 'library.campaign_target' ? `${advisory.code}-${advisory.campaignId}` : advisory.code}>
                <span>{advisory.code}</span>
                {advisory.message} {advisory.shortfall} remaining.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <WorkflowDiagram />

      <section className="content-map-inventory" aria-labelledby="content-map-inventory-heading">
        <div className="content-map-inventory-heading">
          <div>
            <p className="content-map-kicker">Source inventory</p>
            <h2 id="content-map-inventory-heading">Article-level evidence and gates</h2>
          </div>
          <p aria-live="polite">Showing <strong>{filteredRows.length}</strong> of {totals.all} records</p>
        </div>

        <form className="content-map-filters" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Campaign</span>
            <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value as typeof campaignFilter)}>
              <option value="all">All campaigns</option>
              {CAMPAIGNS.map(([campaignId, label]) => <option key={campaignId} value={campaignId}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Funnel stage</span>
            <select value={funnelFilter} onChange={(event) => setFunnelFilter(event.target.value as typeof funnelFilter)}>
              <option value="all">All funnel stages</option>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="publishable">Publishable</option>
            </select>
          </label>
          <label>
            <span>Indexing</span>
            <select value={indexingFilter} onChange={(event) => setIndexingFilter(event.target.value as typeof indexingFilter)}>
              <option value="all">All indexing states</option>
              <option value="index">Index</option>
              <option value="noindex">Noindex</option>
            </select>
          </label>
          <label>
            <span>Evidence QA</span>
            <select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value as typeof evidenceFilter)}>
              <option value="all">All evidence states</option>
              <option value="clear">Clear</option>
              <option value="blocking">Blocking</option>
            </select>
          </label>
          <label>
            <span>Media QA</span>
            <select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as typeof mediaFilter)}>
              <option value="all">All media states</option>
              <option value="clear">Clear</option>
              <option value="blocking">Blocking</option>
            </select>
          </label>
          <label>
            <span>Keyword validation</span>
            <select value={keywordFilter} onChange={(event) => setKeywordFilter(event.target.value as typeof keywordFilter)}>
              <option value="all">All keyword states</option>
              <option value="pending_paid_provider">Pending paid provider</option>
              <option value="validated">Validated</option>
            </select>
          </label>
        </form>

        <div
          aria-label="Scrollable SEO article inventory"
          className="content-map-table-wrap"
          role="region"
          tabIndex={0}
        >
          <table aria-label="SEO article inventory">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Campaign / intent</th>
                <th scope="col">State</th>
                <th scope="col">Keyword evidence</th>
                <th scope="col">QA scores</th>
                <th scope="col">Blocking findings</th>
                <th scope="col">Destinations</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ article, articleReady, audit, publishable }) => {
                const { frontmatter } = article;
                const keywordPending = frontmatter.keyword_evidence.validation_status !== 'validated';
                return (
                  <tr key={frontmatter.article_id}>
                    <th scope="row">
                      <span className="content-map-article-id">{frontmatter.article_id}</span>
                      <strong>{frontmatter.title}</strong>
                      <span>{frontmatter.primary_keyword}</span>
                    </th>
                    <td>
                      <strong>{CAMPAIGN_LABELS[frontmatter.campaign_id]}</strong>
                      <span>{titleCase(frontmatter.funnel_stage)} funnel</span>
                      <span>{titleCase(frontmatter.search_intent)} intent</span>
                    </td>
                    <td>
                      <span className={`content-map-badge is-${frontmatter.status}`}>{titleCase(frontmatter.status)}</span>
                      <span>{frontmatter.indexing}</span>
                      <span>
                        {publishable
                          ? 'Passes active publication gate'
                          : articleReady && !globalIndexingEnabled
                            ? 'Article-level ready · global indexing disabled'
                            : 'Held by article-level gate'}
                      </span>
                    </td>
                    <td>
                      <span className={`content-map-badge ${keywordPending ? 'is-pending' : 'is-validated'}`}>
                        {keywordPending ? 'Pending paid provider' : 'Validated'}
                      </span>
                      <span>{frontmatter.keyword_evidence.provider}</span>
                      <span>US · {frontmatter.serp_evidence.validation_status} SERP</span>
                    </td>
                    <td><QaScores audit={audit} /></td>
                    <td>
                      {audit.blockingFindings.length === 0 ? (
                        <span className="content-map-clear">No blocking findings</span>
                      ) : (
                        <>
                          <strong>{audit.blockingFindings.length} blocking</strong>
                          <ul className="content-map-findings">
                            {audit.blockingFindings.map((finding) => (
                              <li key={finding.code}>
                                <span>{finding.code}</span>
                                {finding.message}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </td>
                    <td>
                      <Link href={frontmatter.canonical_path}>Rendered page</Link>
                      <a href={sourceHref(article.filePath)} rel="noreferrer" target="_blank">Markdown source</a>
                      <code>{article.filePath}</code>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="content-map-empty" colSpan={7}>No records match these filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
