import { describe, expect, it } from 'vitest';
import { isDiscoverySourceUrl, PRODUCTION_SOURCE_AUTHORITY_POLICIES, sourceDiscoveryQueries } from './source-policy';
import { createSafeSourceChecker } from './sources';

describe('subject-appropriate supporting source discovery', () => {
  it.each([
    'content repurposing queue management', 'repurpose webinar content',
    'VIDEO REPURPOSING WORKFLOW', 'content approval workflow',
    'content distribution plan', 'content calendar',
  ])('searches content practitioners for %s without increasing the search budget', keyword => {
    const queries = sourceDiscoveryQueries(keyword, ['What is content repurposing?', 'How can I repurpose content?', 'Why repurpose content?', 'A fourth question?'], 'A practical guide');
    expect(queries).toHaveLength(7);
    expect(queries[0]).toContain('site:buffer.com/resources/');
    expect(queries[1]).toContain('site:optimizely.com/optimization-glossary/');
    expect(queries[2]).toContain('site:techsmith.com/blog/');
    expect(queries[3]).toContain('site:descript.com/blog/article/');
    expect(queries.slice(4)).toEqual(['What is content repurposing?', 'How can I repurpose content?', 'Why repurpose content?']);
    expect(queries.some(query => /site:(ycombinator|techstars)/u.test(query))).toBe(false);
  });

  it('preserves task qualifiers in the new publisher queries', () => {
    expect(sourceDiscoveryQueries('content repurposing queue management', [], 'Content Queues')[0])
      .toBe('content repurposing queue management site:buffer.com/resources/');
  });

  it.each(['founder pitch video', 'product demo checklist', 'message queue management', 'repurposing a warehouse', 'video contentment'])('does not route an unrelated keyword through content operations: %s', keyword => {
    // The title and FAQ cannot override the keyword's publisher profile.
    const queries = sourceDiscoveryQueries(keyword, ['What is content repurposing?'], 'Content repurposing workflow');
    expect(queries[0]).toContain('site:ycombinator.com');
    expect(queries[1]).toContain('site:techstars.com');
  });

  it('applies the same topic choice to legacy two-query discovery', () => {
    const queries = sourceDiscoveryQueries('content repurposing', ['How can I repurpose content?']);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('site:buffer.com/resources/ OR site:optimizely.com/optimization-glossary/');
    expect(queries[0]).not.toContain('site:ycombinator.com');
  });
});

describe('content-practitioner source boundaries', () => {
  const prose = '<article><p>A content repurposing workflow adapts a recorded webinar into short clips for the channels your audience uses.</p></article>';
  const checker = (html = prose, redirect?: string) => createSafeSourceChecker({
    authorityPolicies: PRODUCTION_SOURCE_AUTHORITY_POLICIES,
    resolveHostname: async () => ['93.184.216.34'],
    transport: async request => ({
      status: redirect && request.url === 'https://buffer.com/resources/guide/' ? 302 : 200,
      headers: { 'content-type': 'text/html', ...(redirect && request.url === 'https://buffer.com/resources/guide/' ? { location: redirect } : {}) },
      url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0],
      body: (async function* () { yield new TextEncoder().encode(html); })(),
    }),
  });

  it.each([
    ['https://buffer.com/resources/repurposing-content-guide/', true],
    ['https://www.buffer.com/resources/repurposing-content-guide/', true],
    ['https://www.optimizely.com/optimization-glossary/content-repurposing', true],
    ['https://optimizely.com/optimization-glossary/content-repurposing', true],
    ['https://buffer.com/pricing', false],
    ['https://buffer.com/resources-spoof/guide', false],
    ['https://buffer.com.evil.example/resources/guide', false],
    ['https://community.buffer.com/resources/guide', false],
    ['https://www.optimizely.com/optimization-glossary-spoof/guide', false],
    ['https://www.optimizely.com/products/', false],
    ['https://www.optimizely.com:8443/optimization-glossary/content-repurposing', false],
  ])('requires the scoped final origin and editorial path: %s', async (url, admitted) => {
    expect(isDiscoverySourceUrl(url)).toBe(admitted);
    await expect(checker().read(url, { query: 'content repurposing' })).resolves.toMatchObject({ authoritative: admitted, reachable: true });
  });

  it.each(['https://buffer.com/pricing', 'https://buffer.com:8443/resources/guide/'])('does not carry authority across an out-of-scope redirect: %s', async finalUrl => {
    await expect(checker(prose, finalUrl).read('https://buffer.com/resources/guide/', { query: 'content repurposing' }))
      .resolves.toMatchObject({ finalUrl, authoritative: false });
  });

  it.each([
    ['body evidence', prose, true],
    ['heading without body support', '<article><h1>Content repurposing</h1><p>The garden has flowers and a wooden bench beside the fountain.</p></article>', false],
    ['empty document', '<nav>Home</nav>', false],
  ])('requires usable body support after publisher recognition: %s', async (_label, html, usable) => {
    const selected = checker(html).selectWithContent([
      'https://buffer.com/resources/guide/', 'https://www.optimizely.com/optimization-glossary/content-repurposing',
    ], { query: 'content repurposing' });
    if (usable) await expect(selected).resolves.toMatchObject({ sources: [{ authoritative: true }, { authoritative: true }] });
    else await expect(selected).rejects.toThrow(/relevant|source/i);
  });
});
