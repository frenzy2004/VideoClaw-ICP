import { afterEach, describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import { llmsText } from './llms.txt/route';
import robots from './robots';
import sitemap from './sitemap';

const previousFlag = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
  else process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = previousFlag;
});

describe('campaign discovery controls', () => {
  it('disallows and excludes the private preview by default', () => {
    delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
    expect(sitemap()).toEqual([]);

    const llms = llmsText(false);
    expect(llms).toMatch(/private review build/i);
    expect(llms).not.toContain('/use-cases/demo-day-founder-content');
    expect(llms).not.toContain('/guides/founder-story-after-demo-day');
  });

  it('adds a noindex response header to both the root page and nested routes', async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toEqual(expect.arrayContaining([
      {
        source: '/',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]));
  });

  it('publishes only the two approved routes when the exact flag is enabled', () => {
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'true';
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://videoclaw.com/sitemap.xml',
    });
    expect(sitemap()).toEqual([
      {
        url: 'https://videoclaw.com/use-cases/demo-day-founder-content',
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: 'https://videoclaw.com/guides/founder-story-after-demo-day',
        changeFrequency: 'monthly',
        priority: 0.9,
      },
    ]);

    const llms = llmsText(true);
    expect(llms).toContain('https://videoclaw.com/use-cases/demo-day-founder-content');
    expect(llms).toContain('https://videoclaw.com/guides/founder-story-after-demo-day');
    expect(llms).not.toMatch(/private|noindex|not approved/i);
  });
});
