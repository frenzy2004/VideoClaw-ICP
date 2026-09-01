import type { ArticleRecord } from '../../lib/content/articles';
import type { auditArticle } from '../../lib/seo/article-audit';

type ArticleAudit = ReturnType<typeof auditArticle>;

const funnelLabels = {
  top: 'Top of funnel',
  middle: 'Middle of funnel',
  bottom: 'Bottom of funnel',
} as const;

function formatKeywordState(article: ArticleRecord): string {
  const evidence = article.frontmatter.keyword_evidence;
  if (evidence.validation_status === 'pending_paid_provider') return 'Pending paid provider';
  return `${evidence.provider} · validated ${evidence.observed_at}`;
}

function qaScore(audit: ArticleAudit): number {
  const categories = Object.values(audit.categories);
  if (categories.length === 0) return 0;
  return Math.round(categories.reduce((total, category) => total + category.score, 0) / categories.length);
}

function reviewState(value: boolean): string {
  return value ? 'Checked' : 'Pending';
}

function safeExternalUrl(href: string): string | undefined {
  return /^https?:\/\//i.test(href) ? href : undefined;
}

export default function ArticleAttribution({ article, audit }: { article: ArticleRecord; audit: ArticleAudit }) {
  const { frontmatter } = article;
  const serp = frontmatter.serp_evidence;

  return (
    <aside className="article-attribution" aria-label="Article provenance and editorial QA">
      <div className="article-attribution-heading">
        <p>Review record · {frontmatter.article_id}</p>
        <h2>Why this article exists</h2>
        <p>
          This is an evidence trail for editorial review. It records the customer situation, observed search landscape,
          content gap, sources, media rights, and publication gates behind the article.
        </p>
      </div>

      <dl className="article-attribution-grid">
        <div><dt>Campaign</dt><dd>{frontmatter.campaign_id}</dd></div>
        <div><dt>ICP</dt><dd>{frontmatter.icp}</dd></div>
        <div><dt>Customer trigger</dt><dd>{frontmatter.customer_trigger}</dd></div>
        <div><dt>Funnel</dt><dd>{funnelLabels[frontmatter.funnel_stage]}</dd></div>
        <div><dt>Search intent</dt><dd>{frontmatter.search_intent}</dd></div>
        <div><dt>Primary keyword</dt><dd>{frontmatter.primary_keyword}</dd></div>
        <div><dt>Keyword validation</dt><dd>{formatKeywordState(article)}</dd></div>
        <div className="article-attribution-wide"><dt>Competitor gap</dt><dd>{frontmatter.competitor_gap}</dd></div>
        <div className="article-attribution-wide">
          <dt>SERP observation</dt>
          <dd>
            Observed {serp.observed_at} · {serp.country}/{serp.language} · {serp.organic_result_count} organic results ·
            run {serp.run_id} · dataset {serp.dataset_id}
          </dd>
        </div>
      </dl>

      <div className="article-attribution-section">
        <h3>Observed ranking competitors</h3>
        <ol>
          {serp.top_competitors.map((competitor) => (
            <li key={`${competitor.position}-${competitor.url}`}>
              <span>{competitor.position}</span>
              {safeExternalUrl(competitor.url) ? (
                <a href={competitor.url} rel="noopener noreferrer">{competitor.title}</a>
              ) : <span>{competitor.title}</span>}
              <small>{competitor.domain}</small>
            </li>
          ))}
        </ol>
      </div>

      <div className="article-attribution-section">
        <h3>Sources</h3>
        <ul className="article-source-list">
          {frontmatter.sources.map((source) => (
            <li key={source.url}>
              {safeExternalUrl(source.url) ? (
                <a href={source.url} rel="noopener noreferrer">{source.title}</a>
              ) : <span>{source.title}</span>}
              <span>{source.publisher} · checked {source.checked_at}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="article-attribution-section">
        <h3>VideoClaw editorial QA · {qaScore(audit)}/100</h3>
        <p className="article-qa-boundary">
          Deterministic editorial checks only—not a Google, Ahrefs, or ranking score.
        </p>
        <ul className="article-review-state">
          <li><span>SEO</span><strong>{reviewState(frontmatter.review.seo_checked)}</strong></li>
          <li><span>Evidence</span><strong>{reviewState(frontmatter.review.evidence_checked)}</strong></li>
          <li><span>Editorial</span><strong>{reviewState(frontmatter.review.editorial_checked)}</strong></li>
          <li><span>Media</span><strong>{reviewState(frontmatter.review.media_checked)}</strong></li>
        </ul>
        {audit.blockingFindings.length > 0 ? (
          <details>
            <summary>{audit.blockingFindings.length} publication blocker{audit.blockingFindings.length === 1 ? '' : 's'}</summary>
            <ul className="article-finding-list">
              {audit.blockingFindings.map((finding) => (
                <li key={`${finding.code}-${finding.message}`}><code>{finding.code}</code> {finding.message}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </aside>
  );
}
