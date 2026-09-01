import type { NextConfig } from 'next';

const publicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING === 'true';

const nextConfig: NextConfig = {
  async headers() {
    if (publicIndexing) return [];

    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
