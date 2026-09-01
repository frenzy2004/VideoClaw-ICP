import type { NextConfig } from 'next';

const publicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING === 'true';
const privateIndexingHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
const mediaVariants = ['base', 'investor', 'customer', 'recruiting'];
const revalidatingCache = { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' };

const mediaHeaders = mediaVariants.flatMap((variant) => [
  {
    source: `/media/demo-day/${variant}-16x9.mp4`,
    headers: [
      { key: 'Content-Type', value: 'video/mp4' },
      revalidatingCache,
    ],
  },
  {
    source: `/media/demo-day/${variant}-poster.jpg`,
    headers: [
      { key: 'Content-Type', value: 'image/jpeg' },
      revalidatingCache,
    ],
  },
  {
    source: `/media/demo-day/${variant}.en.vtt`,
    headers: [
      { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
      revalidatingCache,
    ],
  },
]);

const nextConfig: NextConfig = {
  async headers() {
    if (publicIndexing) return mediaHeaders;

    return [
      {
        source: '/',
        headers: privateIndexingHeaders,
      },
      {
        source: '/:path*',
        headers: privateIndexingHeaders,
      },
      ...mediaHeaders,
    ];
  },
};

export default nextConfig;
