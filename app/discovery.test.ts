import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

    const llms = readFileSync(join(process.cwd(), 'public/llms.txt'), 'utf8');
    expect(llms).toContain('Private review build');
    expect(llms).not.toContain('/use-cases/demo-day-founder-content');
    expect(llms).not.toContain('/guides/founder-story-after-demo-day');
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
  });
});
