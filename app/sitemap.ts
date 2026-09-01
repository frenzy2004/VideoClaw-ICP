import type { MetadataRoute } from 'next';
import { getPublishableArticles } from '../lib/content/articles';
import { CAMPAIGN_URLS, isPublicIndexingEnabled } from './campaign-content';

const SITE_URL = 'https://videoclaw.com';

export type DiscoveryArticle = {
  slug: string;
  title: string;
};

function publishableDiscoveryArticles(): DiscoveryArticle[] {
  return getPublishableArticles().map(({ frontmatter }) => ({
    slug: frontmatter.slug,
    title: frontmatter.title,
  }));
}

export function buildSitemap(
  publicIndexing: boolean,
  articles: DiscoveryArticle[] = [],
): MetadataRoute.Sitemap {
  if (!publicIndexing) return [];

  return [
    {
      url: CAMPAIGN_URLS.useCase,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: CAMPAIGN_URLS.guide,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...articles.map(({ slug }) => ({
      url: `${SITE_URL}/blog/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const publicIndexing = isPublicIndexingEnabled();
  return buildSitemap(publicIndexing, publicIndexing ? publishableDiscoveryArticles() : []);
}
