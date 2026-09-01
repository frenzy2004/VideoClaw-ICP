import type { MetadataRoute } from 'next';
import { CAMPAIGN_URLS, isPublicIndexingEnabled } from './campaign-content';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublicIndexingEnabled()) return [];

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
  ];
}
