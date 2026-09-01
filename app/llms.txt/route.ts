import { getPublishableArticles } from '../../lib/content/articles';
import { CAMPAIGN_URLS, isPublicIndexingEnabled } from '../campaign-content';
import type { DiscoveryArticle } from '../sitemap';

export function buildLlmsText(
  publicIndexing: boolean,
  articles: DiscoveryArticle[] = [],
) {
  if (!publicIndexing) {
    return [
      '# VideoClaw private review build',
      '',
      'This campaign is under owner-only editorial review and is not approved for public indexing, model citation, or production use.',
      'Campaign route inventory is intentionally omitted.',
      '',
    ].join('\n');
  }

  return [
    '# VideoClaw',
    '',
    'VideoClaw publishes practical guidance for founder-led, source-controlled video workflows.',
    '',
    '## US Demo Day founder content',
    '',
    `- Use case: ${CAMPAIGN_URLS.useCase}`,
    `- Founder guide: ${CAMPAIGN_URLS.guide}`,
    ...(articles.length > 0
      ? [
          '',
          '## Published guides',
          '',
          ...articles.map(({ slug, title }) => `- ${title}: https://videoclaw.com/blog/${slug}`),
        ]
      : []),
    '',
  ].join('\n');
}

export function llmsText(publicIndexing = isPublicIndexingEnabled()) {
  const articles = publicIndexing
    ? getPublishableArticles().map(({ frontmatter }) => ({
        slug: frontmatter.slug,
        title: frontmatter.title,
      }))
    : [];

  return buildLlmsText(publicIndexing, articles);
}

export function GET() {
  return new Response(llmsText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
