import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleAttribution from '../../../components/article/article-attribution';
import ArticleMarkdown from '../../../components/article/article-markdown';
import { getAllArticles, getArticleBySlug, type ArticleRecord } from '../../../lib/content/articles';
import { auditArticle, isArticlePublishable } from '../../../lib/seo/article-audit';

type ArticleRouteProps = {
  params: Promise<{ slug: string }>;
};

function editorialAssetExists(src: string): boolean {
  if (!src.startsWith('/media/articles/') || src.includes('..')) return false;
  return existsSync(join(process.cwd(), 'public', src.slice(1)));
}

function publicationState(article: ArticleRecord) {
  const audit = auditArticle(article, editorialAssetExists);
  const publishable = isArticlePublishable(
    article,
    audit,
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING === 'true',
  );
  return { audit, publishable };
}

function articleJsonLd(article: ArticleRecord) {
  const { frontmatter } = article;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: frontmatter.title,
    description: frontmatter.description,
    mainEntityOfPage: `https://videoclaw.com${frontmatter.canonical_path}`,
    author: { '@type': 'Organization', name: 'VideoClaw' },
    publisher: { '@type': 'Organization', name: 'VideoClaw', url: 'https://videoclaw.com/' },
  };
}

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function safeNavigationHref(href: string): string | undefined {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;
  return undefined;
}

export async function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.frontmatter.slug }));
}

export async function generateMetadata({ params }: ArticleRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const { frontmatter } = article;
  const { publishable } = publicationState(article);

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    robots: { index: publishable, follow: publishable },
    alternates: publishable ? { canonical: frontmatter.canonical_path } : undefined,
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      type: 'article',
      url: publishable ? frontmatter.canonical_path : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticleRouteProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const { frontmatter } = article;
  const { audit, publishable } = publicationState(article);

  return (
    <main className="article-page" data-article-id={frontmatter.article_id}>
      <p className="article-review-ribbon">
        {publishable ? 'PUBLISHABLE EDITORIAL ARTICLE' : 'EDITORIAL REVIEW · NOINDEX'}
      </p>
      <header className="article-masthead">
        <Link className="wordmark" href="/">VideoClaw</Link>
        <span>SEO · AEO · GEO article library</span>
        <Link href="/seo/content-map">Content map</Link>
      </header>

      <article>
        <header className="article-hero">
          <p className="article-eyebrow">
            {frontmatter.search_intent} · {frontmatter.funnel_stage} funnel · {frontmatter.status}
          </p>
          <h1>{frontmatter.title}</h1>
          <p className="article-description">{frontmatter.description}</p>
        </header>

        <div className="article-reading-layout">
          <ArticleMarkdown body={article.body} />
          <ArticleAttribution article={article} audit={audit} />
        </div>

        <section className="article-media" aria-labelledby="article-media-heading">
          <p className="article-section-label">Source-controlled media</p>
          <h2 id="article-media-heading">Editorial media and rights</h2>
          <div className="article-media-grid">
            {frontmatter.media.map((media) => (
              <figure key={media.src}>
                {media.type === 'image' ? (
                  <Image alt={media.alt} height={675} sizes="(max-width: 760px) 100vw, 760px" src={media.src} width={1200} />
                ) : (
                  <video aria-label={media.alt} controls preload="metadata">
                    <source src={media.src} />
                  </video>
                )}
                <figcaption>
                  <strong>{media.caption}</strong>
                  <span>{media.rights === 'owned' ? 'Owned' : media.rights} · {media.credit}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <footer className="article-cta">
          <p>Next action</p>
          <h2>Turn approved source material into a repeatable video workflow.</h2>
          {safeNavigationHref(frontmatter.cta.href) ? (
            <Link href={frontmatter.cta.href}>{frontmatter.cta.label}</Link>
          ) : <span className="article-unsafe-link">CTA unavailable.</span>}
        </footer>
      </article>

      {publishable ? (
        <script type="application/ld+json">{serializeJsonLd(articleJsonLd(article))}</script>
      ) : null}
    </main>
  );
}
