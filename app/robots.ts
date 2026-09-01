import type { MetadataRoute } from 'next';
import { isPublicIndexingEnabled } from './campaign-content';

export default function robots(): MetadataRoute.Robots {
  if (!isPublicIndexingEnabled()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://videoclaw.com/sitemap.xml',
  };
}
